import type { Product, PricingResult } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Weighted average per-retail-unit purchase cost over the last 7 days.
 * Formula: SUM(boxes × box_cost) / SUM(boxes × units_per_case)
 * Returns null if no purchase data exists in the window.
 */
export async function getWeightedAvgCost(
  supabase: SupabaseClient,
  productId: string
): Promise<number | null> {
  const { data } = await supabase
    .from('product_weighted_costs')
    .select('weighted_unit_cost_pence')
    .eq('product_id', productId)
    .single()

  return data?.weighted_unit_cost_pence ?? null
}

/**
 * Batch version: returns a map of productId → weighted avg cost (pence per retail unit).
 * Products with no recent purchases are omitted from the map.
 */
export async function getWeightedAvgCostBatch(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('product_weighted_costs')
    .select('product_id, weighted_unit_cost_pence')
    .in('product_id', productIds)

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.weighted_unit_cost_pence != null) {
      map.set(row.product_id, row.weighted_unit_cost_pence)
    }
  }
  return map
}

/**
 * Applies three rules in order:
 *   1. price_multiplier  — cost × multiplier
 *   2. market_ceiling    — cap at ceiling if set
 *   3. margin_floor      — warn if effective margin < floor (never blocks)
 *
 * All prices in pence (integers).
 */
/**
 * Calculate suggested retail price.
 * weightedUnitCost: pass the 7-day weighted avg per-retail-unit cost (pence).
 *   If omitted, falls back to product.purchase_cost / case_size (legacy behaviour).
 */
export function calculateSuggestedPrice(product: Product, weightedUnitCost?: number): PricingResult {
  const { id, purchase_cost, case_size, price_multiplier, market_ceiling, margin_floor } = product

  // Prefer weighted avg cost (per retail unit); fall back to static per-box cost ÷ case_size
  const unit_cost = weightedUnitCost != null
    ? weightedUnitCost
    : (case_size > 1 ? purchase_cost / case_size : purchase_cost)
  const raw_price = Math.round(unit_cost * price_multiplier)

  let suggested_price = raw_price
  let rule_applied: PricingResult['rule_applied'] = 'multiplier'

  if (market_ceiling !== null && suggested_price > market_ceiling) {
    suggested_price = market_ceiling
    rule_applied = 'ceiling'
  }

  const margin_percentage = suggested_price > 0
    ? (suggested_price - unit_cost) / suggested_price
    : 0

  const margin_warning = margin_percentage < margin_floor

  if (margin_warning && rule_applied !== 'ceiling') {
    rule_applied = 'floor'
  }

  return {
    product_id: id,
    purchase_cost,
    raw_price,
    suggested_price,
    rule_applied,
    margin_percentage,
    margin_warning,
  }
}

export function calculateBatchSuggestions(products: Product[]): PricingResult[] {
  return products.map(calculateSuggestedPrice)
}

/** Simulate the effect of changing retail price by delta pence */
export function simulatePriceChange(
  product: Product,
  deltaRetailPence: number,
  avgWeeklySalesUnits: number
): {
  new_retail_price: number
  new_margin: number
  extra_revenue_weekly_pence: number
  extra_revenue_annual_pence: number
} {
  const new_retail_price = product.retail_price + deltaRetailPence
  const new_margin = new_retail_price > 0
    ? (new_retail_price - product.purchase_cost) / new_retail_price
    : 0
  const extra_revenue_weekly_pence = deltaRetailPence * avgWeeklySalesUnits
  const extra_revenue_annual_pence = extra_revenue_weekly_pence * 52

  return {
    new_retail_price,
    new_margin,
    extra_revenue_weekly_pence,
    extra_revenue_annual_pence,
  }
}

/** Format pence to £ display string */
export function formatPrice(pence: number): string {
  if (pence < 0) return `-${formatPrice(-pence)}`
  if (pence < 100) return `${pence}p`
  return `£${(pence / 100).toFixed(2)}`
}

/** Format margin as percentage string */
export function formatMargin(margin: number): string {
  return `${(margin * 100).toFixed(1)}%`
}
