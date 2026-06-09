import { calculateSuggestedPrice, getWeightedAvgCostBatch } from './pricing-engine'
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
  const { productName, proposedCost, currentCost, retailPrice, caseSize } = params

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

// ─── Main export ─────────────────────────────────────────────────────────────

export async function autoConfirmInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, units_per_case')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return
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

      // Log to audit table — visible on dashboard
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

      continue  // skip this product — purchase_cost stays unchanged
    }

    // Safe to update
    const { error } = await supabase
      .from('products')
      .update({ purchase_cost: proposedCost })
      .eq('id', productId)

    if (error) {
      // DB trigger fired — log what happened (trigger already wrote the audit row)
      console.error(`[cost-guard] DB trigger blocked ${p.name}: ${error.message}`)
    }
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)

  if (!products || products.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return
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

  if (changingSuggestions.length > 0) {
    await supabase
      .from('price_suggestions')
      .delete()
      .eq('status', 'pending')
      .in('product_id', changingSuggestions.map(s => s.product_id))
    await supabase.from('price_suggestions').insert(changingSuggestions)
  }

  await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
}
