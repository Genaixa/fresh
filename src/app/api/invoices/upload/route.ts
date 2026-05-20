import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseInvoicePdf, fuzzyMatchProduct } from '@/lib/invoice-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const form = await request.formData()
    const pdf = form.get('pdf') as File | null
    const force        = form.get('force') as string | null   // 'identical' | 'replace'
    const replace_id   = form.get('replace_id') as string | null

    if (!pdf) return NextResponse.json({ error: 'No PDF provided' }, { status: 400 })

    // Convert PDF to base64
    const bytes = await pdf.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // ── 1. Parse the PDF first (supplier + date come from the invoice itself) ──
    let parsed
    try {
      parsed = await parseInvoicePdf(base64)
    } catch (err) {
      console.error('Invoice parsing error:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to parse invoice. Please try again.' },
        { status: 500 }
      )
    }

    const supplier_name = parsed.supplier_name
    const invoice_date  = parsed.invoice_date

    // ── 2. Duplicate detection (skip when client has confirmed) ─────────────
    if (!force) {
      const { data: existing } = await supabase
        .from('purchase_invoices')
        .select('id, created_at')
        .eq('supplier_name', supplier_name)
        .eq('invoice_date', invoice_date)
        .neq('status', 'error')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        // Compare item lists
        const { data: existingItems } = await supabase
          .from('purchase_invoice_items')
          .select('product_name_raw, unit_cost')
          .eq('invoice_id', existing.id)
          .order('product_name_raw')

        const newItems = [...parsed.items]
          .sort((a, b) => a.product_name_raw.localeCompare(b.product_name_raw))
          .map(i => ({ product_name_raw: i.product_name_raw, unit_cost: i.unit_cost }))

        const oldItems = (existingItems ?? [])
          .slice()
          .sort((a, b) => a.product_name_raw.localeCompare(b.product_name_raw))

        const isIdentical =
          newItems.length === oldItems.length &&
          newItems.every((ni, idx) =>
            ni.product_name_raw === oldItems[idx].product_name_raw &&
            ni.unit_cost        === oldItems[idx].unit_cost
          )

        if (isIdentical) {
          return NextResponse.json(
            { duplicate: 'identical', existing_id: existing.id, supplier_name, invoice_date },
            { status: 409 }
          )
        }

        // Different — summarise what changed
        const addedItems    = newItems.filter(ni => !oldItems.find(oi => oi.product_name_raw === ni.product_name_raw))
        const removedItems  = oldItems.filter(oi => !newItems.find(ni => ni.product_name_raw === oi.product_name_raw))
        const changedPrices = newItems.filter(ni => {
          const oi = oldItems.find(o => o.product_name_raw === ni.product_name_raw)
          return oi && oi.unit_cost !== ni.unit_cost
        })

        return NextResponse.json(
          {
            duplicate: 'different',
            existing_id: existing.id,
            supplier_name,
            invoice_date,
            changes: {
              added:   addedItems.length,
              removed: removedItems.length,
              repriced: changedPrices.length,
            },
          },
          { status: 409 }
        )
      }
    }

    // ── 3. If replacing an old invoice, delete it and its items first ────────
    if (replace_id) {
      await supabase.from('purchase_invoice_items').delete().eq('invoice_id', replace_id)
      await supabase.from('purchase_invoices').delete().eq('id', replace_id)
    }

    // ── 4. Upload PDF to storage (optional) ──────────────────────────────────
    let pdf_url: string | null = null
    try {
      const storagePath = `invoices/${user.id}/${Date.now()}.pdf`
      const { error: storageErr } = await supabase.storage
        .from('invoices')
        .upload(storagePath, bytes, { contentType: 'application/pdf' })
      if (!storageErr) pdf_url = storagePath
    } catch { /* storage is optional */ }

    // ── 5. Create invoice record ──────────────────────────────────────────────
    const { data: invoice, error: invErr } = await supabase
      .from('purchase_invoices')
      .insert({
        supplier_name,
        invoice_date,
        pdf_url,
        total_amount: parsed.raw_total ?? null,
        status: 'processed',
        created_by: user.id,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      console.error('Invoice insert error:', invErr)
      return NextResponse.json({ error: 'Failed to create invoice record' }, { status: 500 })
    }

    // ── 6. Match and insert line items ────────────────────────────────────────
    const { data: catalogue } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)

    const items = parsed.items.map(item => {
      const matched_id = fuzzyMatchProduct(item.product_name_raw, catalogue ?? [])
      return {
        invoice_id:       invoice.id,
        product_id:       matched_id,
        product_name_raw: item.product_name_raw,
        quantity:         item.quantity,
        unit_cost:        item.unit_cost,
        total_cost:       item.total_cost,
        units_per_case:   item.units_per_case,
        is_matched:       !!matched_id,
      }
    })

    await supabase.from('purchase_invoice_items').insert(items)

    return NextResponse.json({ invoice_id: invoice.id })
  } catch (err) {
    console.error('Upload route unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
