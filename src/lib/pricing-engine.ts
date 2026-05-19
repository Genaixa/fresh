import type { Product, PricingResult } from '@/types'

/**
 * Applies three rules in order:
 *   1. price_multiplier  — cost × multiplier
 *   2. market_ceiling    — cap at ceiling if set
 *   3. margin_floor      — warn if effective margin < floor (never blocks)
 *
 * All prices in pence (integers).
 */
export function calculateSuggestedPrice(product: Product): PricingResult {
  const { id, purchase_cost, price_multiplier, market_ceiling, margin_floor } = product

  const raw_price = Math.round(purchase_cost * price_multiplier)

  let suggested_price = raw_price
  let rule_applied: PricingResult['rule_applied'] = 'multiplier'

  if (market_ceiling !== null && suggested_price > market_ceiling) {
    suggested_price = market_ceiling
    rule_applied = 'ceiling'
  }

  const margin_percentage = suggested_price > 0
    ? (suggested_price - purchase_cost) / suggested_price
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
  if (pence < 100) return `${pence}p`
  return `£${(pence / 100).toFixed(2)}`
}

/** Format margin as percentage string */
export function formatMargin(margin: number): string {
  return `${(margin * 100).toFixed(1)}%`
}
