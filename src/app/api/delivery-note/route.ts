import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseInvoicePdf, fuzzyMatchProduct, lookupMapping, saveMapping, type BoxSpec } from '@/lib/invoice-parser'
import { resolveSupplierName } from '@/lib/supplier-resolve'
import { autoConfirmInvoice } from '@/lib/confirm-invoice'
import { sendTelegram } from '@/lib/telegram'

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

// Primary supplier attribution: each supplier's invoice/delivery number has a
// distinct, non-overlapping syntax (verified across all 721 invoices, 24 Jun):
//   • 7-digit  27xxxxx  → JR Holland   (e.g. 2748241)
//   • 8-digit  112xxxxx → Total Produce (Dole, e.g. 11255942)
//   • DN…/WI…  prefixed → Thomas Baty  (e.g. DN259692, WI1964073)
// This is more reliable than fuzzy header-text matching — it's how the mis-parsed
// Baty note DN259049 (read as our own company) was identified. Returns null if the
// number doesn't match a known pattern, so the caller falls back to the header.
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
      // Footer VAT reg → number pattern → header text (see supplier-resolve.ts).
      const supplierName = resolveSupplierName(parsed)

      // Duplicate check: skip only if this exact delivery note is already in DB
      // (same supplier + date + same item set). Suppliers send multiple delivery
      // notes per day — each PDF should become its own invoice record.
      const { data: sameDay } = await supabase
        .from('purchase_invoices')
        .select('id')
        .eq('supplier_name', supplierName)
        .eq('invoice_date', parsed.invoice_date)
        .neq('status', 'error')

      if (sameDay && sameDay.length > 0) {
        // Duplicate / amendment detection.
        // Suppliers (esp. Dole) sometimes send the same invoice twice: once before
        // all items are added, then again with extra lines. We handle two cases:
        //   (a) Exact duplicate: same item set → skip the new one entirely.
        //   (b) Subset: new invoice contains all items of an existing unconfirmed
        //       invoice PLUS at least one extra → the existing was the incomplete
        //       version; delete it and proceed with the new (more complete) one.
        const newRaws = new Set(parsed.items.map(i => i.product_name_raw))
        let isDuplicate = false
        for (const inv of sameDay) {
          const { data: existingItems } = await supabase
            .from('purchase_invoice_items')
            .select('product_name_raw')
            .eq('invoice_id', inv.id)
          const existingRaws = new Set((existingItems ?? []).map(i => i.product_name_raw))
          const overlap = [...newRaws].filter(r => existingRaws.has(r)).length

          if (overlap === newRaws.size && overlap === existingRaws.size) {
            // Case (a): exact same item set → skip
            isDuplicate = true
            break
          }

          // Case (b): existing is a proper subset of new (same invoice, amended)
          // Only supersede if the existing invoice hasn't been confirmed yet.
          if (overlap === existingRaws.size && newRaws.size > existingRaws.size) {
            const { data: existingInv } = await supabase
              .from('purchase_invoices')
              .select('status')
              .eq('id', inv.id)
              .single()
            if (existingInv?.status === 'uploaded') {
              await supabase.from('purchase_invoice_items').delete().eq('invoice_id', inv.id)
              await supabase.from('purchase_invoices').delete().eq('id', inv.id)
              console.log(`[delivery-note] Deleted superseded partial invoice ${inv.id} (${existingRaws.size} items → ${newRaws.size} items)`)
            }
          }
        }
        if (isDuplicate) continue
      }

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

      const { data: invoice, error: invErr } = await supabase
        .from('purchase_invoices')
        .insert({
          supplier_name:  supplierName,
          invoice_date:   parsed.invoice_date,
          invoice_number: parsed.invoice_number ?? null,
          total_amount:   parsed.raw_total ?? null,
          status:         'uploaded',
          pdf_url:        pdfStoragePath,
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
        .select('id, name, category, unit')
        .eq('is_active', true)

      const productById = new Map((catalogue ?? []).map(p => [p.id, p]))
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

        // David's rule (24 Jun): a JR Holland VEG box with no printed pack size
        // is a 5kg box sold by weight (leeks are the 4.5kg exception). Their
        // invoices routinely omit the size; this auto-costs those lines instead
        // of leaving them spec-less. Only fires when nothing else (mapping,
        // NxWEIGHT marker, LLM) determined a real spec — explicit specs win.
        const noRealSpec = !box_weight_kg && (!units_per_case || units_per_case === 1)
        if (supplierName === 'JR Holland' && matched_id && noRealSpec) {
          const prod = productById.get(matched_id)
          // Only veg actually SOLD BY WEIGHT (products.unit = 'kg'). NOT count/
          // pack veg (unit 'each'/'punnet': cucumber, lettuce, mushrooms, celery,
          // punnets…), where a 5kg box weight is meaningless. `unit` is the real
          // by-weight flag — default_unit_type='box' is not (cucumber is 'box').
          if (prod?.category === 'veg' && prod?.unit === 'kg') {
            box_weight_kg  = /leek/i.test(prod.name) ? 4.5 : 5.0
            unit_type      = 'weight'
            units_per_case = null
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

      // De-duplicate by ticket number: if this supplier already has another invoice
      // with the same number, keep whichever has MORE line items (most complete) and
      // delete the rest. Handles the autopilot grabbing a resent email twice.
      let dedupNote = ''
      if (parsed.invoice_number) {
        const { data: dupes } = await supabase
          .from('purchase_invoices')
          .select('id')
          .eq('supplier_name', supplierName)
          .eq('invoice_number', parsed.invoice_number)
        if (dupes && dupes.length > 1) {
          const withCounts = await Promise.all(dupes.map(async d => {
            const { count } = await supabase
              .from('purchase_invoice_items')
              .select('*', { count: 'exact', head: true })
              .eq('invoice_id', d.id)
            return { id: d.id, n: count ?? 0 }
          }))
          withCounts.sort((a, b) => b.n - a.n) // most items first = the keeper
          const removeIds = withCounts.slice(1).map(d => d.id)
          await supabase.from('purchase_invoice_items').delete().in('invoice_id', removeIds)
          await supabase.from('purchase_invoices').delete().in('id', removeIds)
          if (removeIds.includes(invoice.id)) {
            // The invoice we just ingested is the smaller duplicate — drop it and stop.
            sendTelegram(`🔁 <b>${supplierName}</b> — ticket ${parsed.invoice_number} is a duplicate with fewer lines; ignored, kept the existing fuller copy.`).catch(() => {})
            processed++
            continue
          }
          dedupNote = `\n🔁 <b>Duplicate ticket ${parsed.invoice_number}</b> — kept this fuller copy (${withCounts[0].n} lines), removed ${removeIds.length} smaller duplicate${removeIds.length > 1 ? 's' : ''}.`
        }
      }

      // Auto-confirm: update costs and generate price suggestions immediately
      const confirmResult = await autoConfirmInvoice(supabase, invoice.id)

      const unmatched = itemsToInsert.filter(i => !i.is_matched).length
      const total     = itemsToInsert.length

      // Check for items bought above the product's market ceiling
      const matchedItems = itemsToInsert.filter(i => i.is_matched && i.product_id)
      let overMaxLines: string[] = []
      if (matchedItems.length > 0) {
        const { data: ceilingProducts } = await supabase
          .from('products')
          .select('id, name, market_ceiling')
          .in('id', matchedItems.map(i => i.product_id))
          .not('market_ceiling', 'is', null)
        const ceilingMap = new Map((ceilingProducts ?? []).map(p => [p.id, p]))
        for (const item of matchedItems) {
          const p = ceilingMap.get(item.product_id)
          if (!p?.market_ceiling) continue
          // market_ceiling is per retail unit, but unit_cost is per box — convert
          // the box price down to per-unit before comparing, or every box trips it.
          const divisor = (item.unit_type === 'weight' ? item.box_weight_kg : item.units_per_case) || 1
          const perUnitCost = Math.round(item.unit_cost / divisor)
          if (perUnitCost > p.market_ceiling) {
            const over = Math.round(((perUnitCost - p.market_ceiling) / p.market_ceiling) * 100)
            overMaxLines.push(`  • ${p.name}: paid £${(perUnitCost / 100).toFixed(2)}/unit (max £${(p.market_ceiling / 100).toFixed(2)}, ${over}% over)`)
          }
        }
      }

      const withheld = confirmResult.withheld
      const withheldBlock = withheld.length > 0
        ? `\n🚫 <b>${withheld.length} suggestion${withheld.length > 1 ? 's' : ''} withheld as implausible</b> — review on /pricing:\n${withheld
            .map(w => `  • ${w.name}: blocked £${(w.suggested / 100).toFixed(2)} (plausible max £${(w.ceiling / 100).toFixed(2)})`)
            .join('\n')}`
        : ''

      // Reconciliation: the captured lines should sum to the invoice's printed
      // total. A gap means the parser likely dropped or misread a line — flag it
      // so a missing line never slips through silently again.
      const lineSum = itemsToInsert.reduce((s, i) => s + (i.total_cost ?? 0), 0)

      // INVARIANT: the header total is the EX-VAT goods amount = the sum of the
      // captured line items. We store lineSum (not parsed.raw_total) so the header
      // can NEVER diverge from the items by construction. This is what stopped the
      // 11254559 bug (24 Jun) where the parser grabbed the VAT-inclusive grand
      // total (£487.90) instead of the £475.90 ex-VAT subtotal. parsed.raw_total
      // (now also ex-VAT — see invoice-parser prompt) is kept ONLY as the
      // independent cross-check below.
      if (invoice.total_amount !== lineSum) {
        await supabase
          .from('purchase_invoices')
          .update({ total_amount: lineSum })
          .eq('id', invoice.id)
      }

      const reconcileGap = parsed.raw_total != null ? parsed.raw_total - lineSum : 0
      const reconcileWarning = (parsed.raw_total != null && Math.abs(reconcileGap) > 1)
        ? `\n⚠️ <b>Lines don't add up — check for a missed line:</b>\n  ${total} lines = £${(lineSum / 100).toFixed(2)}, but invoice total = £${(parsed.raw_total / 100).toFixed(2)} (£${(Math.abs(reconcileGap) / 100).toFixed(2)} ${reconcileGap > 0 ? 'missing' : 'extra'})`
        : ''

      const lines = [
        `✅ <b>${supplierName}</b> invoice processed (${parsed.invoice_date})`,
        `${total} items — ${total - unmatched} matched, ${unmatched > 0 ? `⚠️ ${unmatched} unmatched` : '✓ all matched'}`,
        parsed.raw_total ? `Total: £${(parsed.raw_total / 100).toFixed(2)}` : '',
        reconcileWarning,
        dedupNote,
        overMaxLines.length > 0 ? `\n⚠️ <b>Paid over max price:</b>\n${overMaxLines.join('\n')}` : '',
        withheldBlock,
      ].filter(Boolean).join('\n')
      sendTelegram(lines).catch(() => {})

      processed++
    } catch (err) {
      console.error('Error processing PDF attachment:', err)
      const errMsg = err instanceof Error ? err.message : String(err)
      sendTelegram(`❌ <b>Invoice failed to process</b>\nFile: ${pdf.Name}\n${errMsg}`).catch(() => {})
    }
  }

  return NextResponse.json({ processed })
}
