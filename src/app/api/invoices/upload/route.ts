import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseInvoicePdf, fuzzyMatchProduct } from '@/lib/invoice-parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const form = await request.formData()
  const pdf = form.get('pdf') as File | null
  const invoice_date = form.get('invoice_date') as string
  const supplier_name = (form.get('supplier_name') as string) || 'Unknown'

  if (!pdf) return NextResponse.json({ error: 'No PDF provided' }, { status: 400 })

  // Convert PDF to base64
  const buffer = await pdf.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  // Upload PDF to Supabase Storage
  const storagePath = `invoices/${user.id}/${Date.now()}.pdf`
  await supabase.storage.from('invoices').upload(storagePath, buffer, {
    contentType: 'application/pdf',
  })

  // Create invoice record (status: processing)
  const { data: invoice, error: invErr } = await supabase
    .from('purchase_invoices')
    .insert({
      supplier_name,
      invoice_date,
      pdf_url: storagePath,
      status: 'processing',
      created_by: user.id,
    })
    .select()
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Failed to create invoice record' }, { status: 500 })
  }

  try {
    // Parse with Claude
    const parsed = await parseInvoicePdf(base64)

    // Load product catalogue for fuzzy matching
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
        is_matched:       !!matched_id,
      }
    })

    await supabase.from('purchase_invoice_items').insert(items)

    // Update supplier name from parsed if not provided
    const updatePayload: Record<string, unknown> = { status: 'processed' }
    if (!form.get('supplier_name') && parsed.supplier_name !== 'Unknown') {
      updatePayload.supplier_name = parsed.supplier_name
    }
    if (parsed.invoice_date) {
      updatePayload.invoice_date = parsed.invoice_date
    }
    if (parsed.raw_total) {
      updatePayload.total_amount = parsed.raw_total
    }

    await supabase.from('purchase_invoices').update(updatePayload).eq('id', invoice.id)

    return NextResponse.json({ invoice_id: invoice.id })
  } catch (err) {
    await supabase.from('purchase_invoices')
      .update({ status: 'error' })
      .eq('id', invoice.id)

    console.error('Invoice parsing error:', err)
    return NextResponse.json(
      { error: 'Failed to parse invoice. Please try again.' },
      { status: 500 }
    )
  }
}
