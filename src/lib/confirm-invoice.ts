import { calculateSuggestedPrice, getWeightedAvgCostBatch, buildPlausibilityContext, checkPlausibility } from './pricing-engine'
import { runPostInvoiceGolem } from './data-golem'
import { sendTelegram } from './telegram'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '@/types'

// ─── Cost-change safety rules ────────────────────────────────────────────────
//
// Three independent checks applied before writing purchase_cost.
// Any failure logs to cost_change_audit and skips the update for that product.
// The DB trigger (trg_cost_safety_guard) is a final backstop that blocks
// cost > retail regardless of how the write arrives.
//
// Rule 1: Never set cost above retail price — no product should sell at a loss.
//
// Rule 2: Block > 5× jump from an established cost (≥ 30p).
//   Catches per-case prices treated as per-unit: e.g. Chinese Leaves £8.80/box
//   of 10 stored as 880p when it should be 88p (10× jump caught here).
//
// Rule 3: If proposed_cost / case_size ≈ current_cost (within 25%), the caller
//   passed the case price instead of the per-unit price.  Block it.

const MIN_TRUSTED_COST  = 30   // costs below this are "new/unset" — allow any change
const MAX_JUMP_RATIO    = 5.0  // block if new cost > old × 5

function costChangeSafe(params: {
  productName: string
  proposedCost: number
  currentCost:  number
  retailPrice:  number
  caseSize:     number
}): { safe: boolean; reason: string } {
  const { productName: _name, proposedCost, currentCost, retailPrice, caseSize } = params

  // Rule 1 — cost > retail
  if (retailPrice > 0 && proposedCost > retailPrice) {
    return {
      safe:   false,
      reason: `Rule 1: cost ${proposedCost}p > retail ${retailPrice}p — likely per-case price stored as per-unit`,
    }
  }

  // Rules 2 & 3 only apply when we have an established baseline cost
  if (currentCost >= MIN_TRUSTED_COST) {

    // Rule 2 — implausibly large jump
    const ratio = proposedCost / currentCost
    if (ratio > MAX_JUMP_RATIO) {
      return {
        safe:   false,
        reason: `Rule 2: cost would jump ${currentCost}p → ${proposedCost}p (${ratio.toFixed(1)}×) — likely per-case price`,
      }
    }

    // Rule 3 — proposed cost divided by case_size ≈ current cost (per-case passed as per-unit)
    if (caseSize > 1) {
      const impliedPerUnit = Math.round(proposedCost / caseSize)
      const drift = Math.abs(impliedPerUnit - currentCost) / currentCost
      if (drift < 0.25) {
        return {
          safe:   false,
          reason: `Rule 3: ${proposedCost}p ÷ case_size ${caseSize} = ${impliedPerUnit}p ≈ current ${currentCost}p — this is the case price, not the per-unit cost`,
        }
      }
    }
  }

  return { safe: true, reason: '' }
}

// ─── Post-confirmation health sweep ──────────────────────────────────────────
// Runs immediately after every invoice is confirmed, scoped to that invoice's
// products. This is the primary trigger — David always confirms invoices the
// moment he gets back from market, so the check fires at exactly the right time
// without any scheduling.
//
// Checks applied to the invoice's products only:
//   A. At-loss: cost > retail after the update (belt-and-suspenders vs trigger)
//   B. Case-size mismatch: stored cost × case_size ≈ this invoice's line price
//   C. Cost spike: weighted 7-day cost > 40% above stored baseline (genuine rise)
//
// Results go to cost_change_audit — dashboard surfaces them immediately.

async function runPostConfirmHealthSweep(
  supabase: SupabaseClient,
  productIds: string[],
  invoiceId: string,
): Promise<void> {
  if (productIds.length === 0) return

  // Fetch final product state after all updates
  const { data: products } = await supabase
    .from('products')
    .select('id, name, purchase_cost, retail_price, case_size, is_active')
    .in('id', productIds)
    .eq('is_active', true)

  if (!products?.length) return

  // Latest invoice line prices for case-size mismatch check
  const { data: invoiceItems } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .in('product_id', productIds)

  const invoiceCostMap = new Map<string, number>(
    (invoiceItems ?? []).map(i => [i.product_id, i.unit_cost])
  )

  // 7-day weighted costs for spike detection
  const { data: weightedRows } = await supabase
    .from('product_weighted_costs')
    .select('product_id, weighted_unit_cost_pence')
    .in('product_id', productIds)

  const weightedMap = new Map<string, number>(
    (weightedRows ?? []).map(r => [r.product_id, r.weighted_unit_cost_pence])
  )

  // Already logged today — don't duplicate alerts for the same product
  const { data: todayAlerts } = await supabase
    .from('cost_change_audit')
    .select('product_id, reason')
    .in('product_id', productIds)
    .gte('created_at', new Date().toISOString().slice(0, 10))  // today
    .eq('source', 'invoice_check')

  const alreadyAlerted = new Set((todayAlerts ?? []).map(a => a.product_id))

  const toInsert: Record<string, unknown>[] = []

  for (const p of products) {
    if (alreadyAlerted.has(p.id)) continue

    const cost   = p.purchase_cost ?? 0
    const retail = p.retail_price  ?? 0

    // Check A — at a loss after confirmation
    if (retail > 0 && cost > retail) {
      toInsert.push({
        product_id:    p.id,
        product_name:  p.name,
        old_cost:      cost,
        proposed_cost: cost,
        retail_price:  retail,
        reason:        `POST-CONFIRM CHECK A: selling at a loss — cost ${cost}p > retail ${retail}p. Fix urgently.`,
        blocked:       true,
        source:        'invoice_check',
      })
      continue
    }

    // Check B — stored purchase_cost ≈ invoice box price (case price stored as per-unit by mistake)
    // Catches: someone stored 1300p (box price) instead of 130p (per-unit price).
    // Correct data: cost=130p, invoiceLine=1300p → drift=900% → no fire.
    // Wrong data:   cost=1300p, invoiceLine=1300p → drift=0% → fires correctly.
    const caseSize    = p.case_size ?? 1
    const invoiceLine = invoiceCostMap.get(p.id)
    if (caseSize > 1 && cost >= MIN_TRUSTED_COST && invoiceLine) {
      const drift = Math.abs(cost - invoiceLine) / invoiceLine
      if (drift < 0.15) {
        toInsert.push({
          product_id:    p.id,
          product_name:  p.name,
          old_cost:      cost,
          proposed_cost: invoiceLine,
          retail_price:  retail,
          reason:        `POST-CONFIRM CHECK B: stored cost ${cost}p ≈ invoice box price ${invoiceLine}p — looks like the box price was stored as the per-unit cost (should be ~${Math.round(invoiceLine / caseSize)}p for case_size ${caseSize}).`,
          blocked:       true,
          source:        'invoice_check',
        })
        continue
      }
    }

    // Check C — genuine cost spike (40–400% above baseline, not a unit mismatch)
    const weighted = weightedMap.get(p.id)
    if (weighted && cost >= MIN_TRUSTED_COST && weighted > cost * 1.4 && weighted < cost * 4) {
      const pctRise = Math.round((weighted / cost - 1) * 100)
      toInsert.push({
        product_id:    p.id,
        product_name:  p.name,
        old_cost:      cost,
        proposed_cost: weighted,
        retail_price:  retail,
        reason:        `POST-CONFIRM CHECK C: cost rose ${pctRise}% this week (stored ${cost}p, 7-day avg ${weighted}p). Consider raising retail price.`,
        blocked:       false,
        source:        'invoice_check',
      })
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('cost_change_audit').insert(toInsert)
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/** What autoConfirmInvoice held back, so the autopilot digest can mention it. */
export interface ConfirmResult {
  withheld: { name: string; suggested: number; ceiling: number }[]
}

export async function autoConfirmInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<ConfirmResult> {
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, units_per_case')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return { withheld: [] }
  }

  // Update case_size from invoice where available
  for (const item of items) {
    if (item.units_per_case && item.units_per_case > 1) {
      await supabase.from('products').update({ case_size: item.units_per_case }).eq('id', item.product_id)
    }
  }

  const productIds = [...new Set(
    items.map(i => i.product_id).filter((id): id is string => id !== null)
  )]

  const weightedCosts = await getWeightedAvgCostBatch(supabase, productIds)

  // Fetch current product state so we can validate before writing
  const { data: currentProducts } = await supabase
    .from('products')
    .select('id, name, purchase_cost, retail_price, case_size')
    .in('id', productIds)

  const productMap = new Map(
    (currentProducts ?? []).map(p => [p.id, p])
  )

  // Apply cost updates with safety validation
  for (const [productId, proposedCost] of weightedCosts) {
    const p = productMap.get(productId)
    if (!p) continue

    const check = costChangeSafe({
      productName:  p.name,
      proposedCost,
      currentCost:  p.purchase_cost ?? 0,
      retailPrice:  p.retail_price  ?? 0,
      caseSize:     p.case_size     ?? 1,
    })

    if (!check.safe) {
      console.warn(`[cost-guard] BLOCKED ${p.name}: ${check.reason}`)

      await supabase.from('cost_change_audit').insert({
        product_id:    productId,
        product_name:  p.name,
        old_cost:      p.purchase_cost,
        proposed_cost: proposedCost,
        retail_price:  p.retail_price,
        reason:        check.reason,
        blocked:       true,
        source:        'pipeline',
      })

      // Rule 1 = selling at a loss — notify immediately, it needs fixing before next sale
      if (check.reason.startsWith('Rule 1')) {
        sendTelegram(
          `🔴 <b>Selling at a loss — ${p.name}</b>\nCost £${(proposedCost / 100).toFixed(2)} but retail is only £${((p.retail_price ?? 0) / 100).toFixed(2)}. Fix the retail price urgently.`
        ).catch(() => {})
      }

      continue
    }

    const { error } = await supabase
      .from('products')
      .update({ purchase_cost: proposedCost })
      .eq('id', productId)

    if (error) {
      console.error(`[cost-guard] DB trigger blocked ${p.name}: ${error.message}`)
    }
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)

  if (!products || products.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return { withheld: [] }
  }

  const suggestions = (products as Product[]).map(product => {
    const weightedCost = weightedCosts.get(product.id) ?? undefined
    const result = calculateSuggestedPrice(product, weightedCost)
    return {
      product_id:             product.id,
      invoice_id:             invoiceId,
      current_retail_price:   product.retail_price,
      suggested_retail_price: result.suggested_price,
      rule_applied:           result.rule_applied,
      margin_percentage:      result.margin_percentage,
      margin_warning:         result.margin_warning,
      status:                 'pending' as const,
    }
  })

  const changingSuggestions = suggestions.filter(s => {
    const cost = weightedCosts.get(s.product_id) ?? 0
    if (s.suggested_retail_price <= cost) return false
    const product = (products as Product[]).find(p => p.id === s.product_id)
    const floor   = product?.margin_floor ?? 0.20
    const ceiling = product?.market_ceiling ?? null
    const isUnpriced    = s.current_retail_price === 0
    const currentMargin = s.current_retail_price > 0
      ? (s.current_retail_price - cost) / s.current_retail_price : -1
    return isUnpriced || currentMargin < floor || (ceiling !== null && s.current_retail_price > ceiling)
  })

  // Plausibility filter — divert implausible suggestions (£29 avocado) to 'withheld'
  // so they never enter the pending / Approve-All / Telegram path. They stay visible
  // in the /pricing review queue with a diagnosis instead of being deleted.
  const withheld: ConfirmResult['withheld'] = []
  if (changingSuggestions.length > 0) {
    const ctx = await buildPlausibilityContext(supabase, changingSuggestions.map(s => s.product_id))

    const finalised = changingSuggestions.map(s => {
      const product  = (products as Product[]).find(p => p.id === s.product_id)!
      const unitCost = weightedCosts.get(s.product_id) ?? product.purchase_cost
      const pl = checkPlausibility(product, s.suggested_retail_price, unitCost, ctx)
      if (!pl.plausible) {
        withheld.push({ name: product.name, suggested: s.suggested_retail_price, ceiling: pl.ceiling })
      }
      return {
        ...s,
        status:               pl.plausible ? ('pending' as const) : ('withheld' as const),
        block_reason:         pl.reason,
        plausibility_ceiling: pl.ceiling === Number.MAX_SAFE_INTEGER ? null : pl.ceiling,
      }
    })

    const ids = finalised.map(s => s.product_id)
    // Clear any prior pending/withheld for these products so we don't duplicate
    await supabase.from('price_suggestions').delete().in('status', ['pending', 'withheld']).in('product_id', ids)
    await supabase.from('price_suggestions').insert(finalised)
  }

  await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)

  // Health sweep — scoped to this invoice's products
  await runPostConfirmHealthSweep(supabase, productIds, invoiceId)

  // Data Golem — broader staleness and drift checks, fire-and-forget
  const { data: inv } = await supabase
    .from('purchase_invoices').select('supplier_name').eq('id', invoiceId).single()
  runPostInvoiceGolem(supabase, invoiceId, inv?.supplier_name ?? '').catch(err =>
    console.error('[DataGolem] post-invoice error:', err)
  )

  return { withheld }
}
