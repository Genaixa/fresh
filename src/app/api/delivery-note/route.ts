import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseInvoicePdf, fuzzyMatchProduct, lookupMapping, saveMapping, type BoxSpec } from '@/lib/invoice-parser'

interface PostmarkAttachment {
  Name: string
  Content: string       // base64
  ContentType: string
  ContentLength: number
}

interface PostmarkInbound {
  From: string
  Subject: string
  Attachments?: PostmarkAttachment[]
  MessageID: string
}

function normaliseSupplier(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('holland') || lower.includes('devorah')) return 'JR Holland'
  if (lower.includes('dole') || lower.includes('redbridge') || lower.includes('gateshead') || lower.includes('total produce')) return 'Total Produce'
  return raw
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  // Verify secret token — Postmark passes this as a query param
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: PostmarkInbound
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pdfs = (body.Attachments ?? []).filter(
    a => a.ContentType === 'application/pdf' || a.Name?.toLowerCase().endsWith('.pdf')
  )

  if (pdfs.length === 0) {
    // Email arrived but no PDF — acknowledge so Postmark stops retrying
    return NextResponse.json({ processed: 0, note: 'no PDF attachment' })
  }

  const supabase = createServiceClient()
  let processed = 0

  for (const pdf of pdfs) {
    try {
      const parsed = await parseInvoicePdf(pdf.Content)
      const supplierName = normaliseSupplier(parsed.supplier_name)

      // Skip duplicates — same supplier + date already in DB
      const { data: existing } = await supabase
        .from('purchase_invoices')
        .select('id')
        .eq('supplier_name', supplierName)
        .eq('invoice_date', parsed.invoice_date)
        .neq('status', 'error')
        .maybeSingle()

      if (existing) continue

      // Store original PDF in Supabase storage
      let pdfStoragePath: string | null = null
      try {
        const pdfBytes = Buffer.from(pdf.Content, 'base64')
        const safeName = supplierName.toLowerCase().replace(/\s+/g, '-')
        pdfStoragePath = `${safeName}/${parsed.invoice_date}/${body.MessageID}.pdf`
        await supabase.storage.from('invoices').upload(pdfStoragePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
      } catch (uploadErr) {
        console.error('PDF storage upload failed:', uploadErr)
        pdfStoragePath = null
      }

      // Create invoice as 'uploaded' — requires David's confirmation
      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          supplier_name: supplierName,
          invoice_date:  parsed.invoice_date,
          total_amount:  parsed.raw_total ?? null,
          status:        'uploaded',
          pdf_url:       pdfStoragePath,
        })
        .select()
        .single()

      if (invErr || !invoice) {
        console.error('Invoice insert error:', invErr)
        continue
      }

      // Match line items against product catalogue
      const { data: catalogue } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)

      const itemsToInsert = []
      for (const item of parsed.items) {
        const savedMapping = await lookupMapping(supabase, supplierName, item.product_name_raw)

        let matched_id     = savedMapping?.product_id ?? null
        let unit_type      = savedMapping?.unit_type     ?? item.unit_type
        let units_per_case = savedMapping?.units_per_case ?? item.units_per_case
        let box_weight_kg  = savedMapping?.box_weight_kg  ?? item.box_weight_kg

        if (!matched_id) {
          matched_id = fuzzyMatchProduct(item.product_name_raw, catalogue ?? [])
          if (matched_id) {
            const boxSpec: BoxSpec = {
              unit_type:      item.unit_type,
              units_per_case: item.units_per_case,
              box_weight_kg:  item.box_weight_kg,
              last_price_p:   item.unit_cost,
            }
            await saveMapping(supabase, supplierName, item.product_name_raw, matched_id, null, boxSpec)
          }
        }

        itemsToInsert.push({
          invoice_id:       invoice.id,
          product_id:       matched_id,
          product_name_raw: item.product_name_raw,
          brand_raw:        item.brand_raw || null,
          quantity:         item.quantity,
          unit_cost:        item.unit_cost,
          total_cost:       item.total_cost,
          unit_type,
          units_per_case,
          box_weight_kg,
          is_matched:       !!matched_id,
        })
      }

      if (itemsToInsert.length > 0) {
        await supabase.from('purchase_invoice_items').insert(itemsToInsert)
      }

      processed++
    } catch (err) {
      console.error('Error processing PDF attachment:', err)
    }
  }

  return NextResponse.json({ processed })
}
