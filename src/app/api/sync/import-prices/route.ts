import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseEposProductExport,
  classifyPriceChange,
  normaliseName,
  type PriceSyncDecision,
} from '@/lib/epos-sync'

// Relative redirect — see import-sales route for why a bare Location header.
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } })
}

/**
 * Import retail prices FROM EPOS Now (the source of truth for shelf price).
 * Upload the EPOS product/items export (with a SalePriceIncTax column).
 * Buttons are matched to catalogue products by name (EPOS export has no
 * ProductId), using both products.name and the button names already seen in
 * sales_data. Normal corrections are applied; large swings are HELD for review
 * (unit-basis mismatches). Every decision is logged to epos_price_sync_log.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return seeOther('/login')

    const form = await request.formData()
    const file = form.get('csv') as File | null
    if (!file) return seeOther('/sync/prices?error=No+file+uploaded')

    const text = await file.text()
    const { rows, errors } = parseEposProductExport(text)
    if (rows.length === 0) {
      const msg = errors[0] ?? 'No valid rows found — check file format'
      return seeOther(`/sync/prices?error=${encodeURIComponent(msg)}`)
    }

    // Build a name -> {product_id, name, old_retail} map. products.name first
    // (canonical), then EPOS button names from sales_data as fallback aliases.
    const { data: products } = await supabase
      .from('products')
      .select('id, name, retail_price, epos_now_id')
      .eq('is_active', true)

    type Match = { product_id: string; matched_name: string; old_retail: number }
    const toMatch = (p: { id: string; name: string; retail_price: number | null }): Match =>
      ({ product_id: p.id, matched_name: p.name, old_retail: p.retail_price ?? 0 })
    const prodById = new Map((products ?? []).map(p => [p.id, p]))

    // ── ID-first matching (rename-proof) ────────────────────────────────
    // The price export keys on button name, but names drift if David renames
    // a button in EPOS. The stable key is the EPOS product id. We already
    // hold it per product (products.epos_now_id) + promo/dup buttons
    // (product_epos_aliases). To turn the export's name into an id we bridge
    // through sales_data, which carries EPOS's own button name -> id.
    const prodByEposId = new Map<string, Match>()
    for (const p of (products ?? [])) {
      if (p.epos_now_id) prodByEposId.set(p.epos_now_id, toMatch(p))
    }
    const { data: aliases } = await supabase
      .from('product_epos_aliases')
      .select('epos_product_id, product_id')
    for (const a of (aliases ?? [])) {
      if (prodByEposId.has(a.epos_product_id)) continue
      const p = prodById.get(a.product_id as string)
      if (p) prodByEposId.set(a.epos_product_id, toMatch(p))
    }

    // EPOS button name -> EPOS id, from sales history (EPOS's own naming).
    const { data: salesNames } = await supabase
      .from('sales_data')
      .select('product_id, product_name_raw, epos_product_id')
      .not('product_id', 'is', null)
    const nameToEposId = new Map<string, string>()
    const byName = new Map<string, Match>()
    for (const p of (products ?? [])) byName.set(normaliseName(p.name), toMatch(p))
    for (const s of (salesNames ?? [])) {
      const key = normaliseName(s.product_name_raw)
      if (!key) continue
      if (s.epos_product_id && !nameToEposId.has(key)) nameToEposId.set(key, s.epos_product_id)
      if (!byName.has(key)) {
        const p = prodById.get(s.product_id as string)
        if (p) byName.set(key, toMatch(p))
      }
    }

    // Resolve one export row: by EPOS id first, then fall back to name.
    const resolve = (eposName: string): Match | null => {
      const key = normaliseName(eposName)
      const eid = nameToEposId.get(key)
      if (eid && prodByEposId.get(eid)) return prodByEposId.get(eid)!
      return byName.get(key) ?? null
    }

    // Classify every EPOS row. Dedup on product: if several buttons map to the
    // same product, keep the first decisive (applied/review) one.
    const decisions: PriceSyncDecision[] = []
    const seenProduct = new Set<string>()
    for (const r of rows) {
      const match = resolve(r.name)
      const { status, reason } = classifyPriceChange(match, r.retail_pence)
      if (match && seenProduct.has(match.product_id) && status !== 'unmatched') continue
      if (match && (status === 'applied' || status === 'review')) seenProduct.add(match.product_id)
      decisions.push({
        epos_name: r.name,
        new_retail: r.retail_pence,
        product_id: match?.product_id ?? null,
        matched_name: match?.matched_name ?? null,
        old_retail: match?.old_retail ?? null,
        status, reason,
      })
    }

    const runId = crypto.randomUUID()

    // Apply the safe corrections.
    const applied = decisions.filter(d => d.status === 'applied' && d.product_id)
    for (const d of applied) {
      await supabase.from('products').update({ retail_price: d.new_retail }).eq('id', d.product_id!)
      await supabase.from('price_history').insert({
        product_id: d.product_id!, price_type: 'retail',
        old_price: d.old_retail ?? 0, new_price: d.new_retail,
        reason: 'epos_price_sync', changed_by: user.id,
      })
    }

    // Log every decision for the results view + audit trail.
    await supabase.from('epos_price_sync_log').insert(
      decisions.map(d => ({
        run_id: runId, product_id: d.product_id, epos_name: d.epos_name,
        matched_name: d.matched_name, old_retail: d.old_retail, new_retail: d.new_retail,
        status: d.status, reason: d.reason ?? null, created_by: user.id,
      }))
    )

    return seeOther(`/sync/prices?run=${runId}`)
  } catch (err) {
    console.error('Import prices unhandled error:', err)
    return seeOther('/sync/prices?error=Import+failed.+Please+try+again.')
  }
}
