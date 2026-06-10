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
  const { id, purchase_cost, price_multiplier, market_ceiling, margin_floor } = product

  // purchase_cost is always per-retail-unit (kept in sync by invoice confirmation).
  // Weighted avg is preferred when available (more current than the stored snapshot).
  const unit_cost = weightedUnitCost ?? purchase_cost
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

// ─── Plausibility filter ──────────────────────────────────────────────────────
//
// Stops bogus suggestions (e.g. a £29 avocado from a case-as-unit cost) reaching
// David's pending list. A suggested retail is implausible if it exceeds a ceiling
// built from anchors that DON'T depend on the (possibly bad) cost:
//
//   ceiling = max( current_retail × 3,  hist_retail_max × 3,  category_median × 4 )
//
// max() is deliberate — only withhold when EVERY available anchor agrees the price
// is absurd, so a genuine premium product (anchored by its own high price) is never
// falsely blocked. Only the high side is filtered; loss leaders sell low on purpose.
//
// These constants are mirrored in the SQL retail-write guard (migration 0075).
// Change both together.

export const PLAUSIBILITY = {
  TRUSTED_RETAIL_MIN: 20,  // pence — below this a price isn't a trustworthy anchor
  CURRENT_MULTIPLE:   3,   // suggested may reach 3× the current live price …
  HIST_MULTIPLE:      3,   // … or 3× the best-ever retail …
  CATEGORY_MULTIPLE:  4,   // … or 4× the category median (fallback for new/unpriced)
} as const

export interface PlausibilityContext {
  categoryMedian: Map<string, number>  // category → median retail (pence)
  histRetailMax:  Map<string, number>  // product_id → max historical retail (pence)
}

/** Gather the reference data the plausibility check needs, in two batch queries. */
export async function buildPlausibilityContext(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<PlausibilityContext> {
  const categoryMedian = new Map<string, number>()
  const histRetailMax  = new Map<string, number>()

  // Category medians across all active, priced products
  const { data: priced } = await supabase
    .from('products')
    .select('category, retail_price')
    .eq('is_active', true)
    .gt('retail_price', 0)

  const byCat = new Map<string, number[]>()
  for (const p of (priced ?? []) as { category: string; retail_price: number }[]) {
    const arr = byCat.get(p.category) ?? []
    arr.push(p.retail_price)
    byCat.set(p.category, arr)
  }
  for (const [cat, arr] of byCat) {
    arr.sort((a, b) => a - b)
    const mid = Math.floor(arr.length / 2)
    categoryMedian.set(cat, arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2))
  }

  // Best-ever retail per product, from the immutable price_history log
  if (productIds.length > 0) {
    const { data: hist } = await supabase
      .from('price_history')
      .select('product_id, new_price')
      .eq('price_type', 'retail')
      .in('product_id', productIds)
    for (const h of (hist ?? []) as { product_id: string; new_price: number }[]) {
      if (h.new_price > (histRetailMax.get(h.product_id) ?? 0)) {
        histRetailMax.set(h.product_id, h.new_price)
      }
    }
  }

  return { categoryMedian, histRetailMax }
}

type PlausibilityProduct = Pick<
  Product,
  'id' | 'name' | 'category' | 'retail_price' | 'case_size' | 'price_multiplier'
>

/** The plausible-max ceiling for a product (pence). MAX_SAFE_INTEGER ⇒ no anchor. */
export function plausibleCeiling(product: PlausibilityProduct, ctx: PlausibilityContext): number {
  const { TRUSTED_RETAIL_MIN, CURRENT_MULTIPLE, HIST_MULTIPLE, CATEGORY_MULTIPLE } = PLAUSIBILITY
  const anchors: number[] = []

  if (product.retail_price >= TRUSTED_RETAIL_MIN) anchors.push(product.retail_price * CURRENT_MULTIPLE)

  const hist = ctx.histRetailMax.get(product.id) ?? 0
  if (hist >= TRUSTED_RETAIL_MIN) anchors.push(hist * HIST_MULTIPLE)

  const median = ctx.categoryMedian.get(product.category) ?? 0
  if (median > 0) anchors.push(median * CATEGORY_MULTIPLE)

  if (anchors.length === 0) return Number.MAX_SAFE_INTEGER  // nothing to judge against — don't block
  return Math.max(...anchors)
}

export interface PlausibilityResult {
  plausible: boolean
  ceiling:   number        // pence (MAX_SAFE_INTEGER if no anchor)
  reason:    string | null // plain-English diagnosis when withheld
}

/**
 * Judge a suggested retail price and, when implausible, diagnose the likely cause
 * from the cost / multiplier / case-size — so David goes from "£29?!" to "ah, the
 * box price was read as per-unit" in one glance.
 */
export function checkPlausibility(
  product: PlausibilityProduct,
  suggestedPrice: number,
  unitCost: number,
  ctx: PlausibilityContext,
): PlausibilityResult {
  const ceiling = plausibleCeiling(product, ctx)
  if (suggestedPrice <= ceiling) return { plausible: true, ceiling, reason: null }

  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`
  const caseSize = product.case_size ?? 1

  let cause: string
  if (product.retail_price > 0 && unitCost >= product.retail_price) {
    const hint = caseSize > 1 ? ` (÷ case of ${caseSize} ≈ ${gbp(Math.round(unitCost / caseSize))}/unit)` : ''
    cause = `the cost used (${gbp(unitCost)}) is at or above the current shelf price (${gbp(product.retail_price)})${hint} — almost certainly a per-case price read as per-unit. Check units_per_case on the source invoice line.`
  } else if (product.price_multiplier > 5) {
    cause = `the price multiplier is set to ${product.price_multiplier}× — looks mis-configured.`
  } else {
    cause = `cost may have genuinely jumped to ${gbp(unitCost)}. If that's real, set the price by hand.`
  }

  return {
    plausible: false,
    ceiling,
    reason: `Suggested ${gbp(suggestedPrice)} exceeds the plausible max ${gbp(ceiling)} — ${cause}`,
  }
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
