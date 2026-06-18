import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deterministic consistency net for the price-suggestion subsystem.
 *
 * Background: a pending suggestion is a frozen snapshot. The live code now keeps
 * it fresh (recompute-on-apply + regenerate-on-cost-change), but THIS check is the
 * belt-and-braces — it asserts the invariants directly against the data every
 * night, so if any future code path ever writes a stale or contradictory row, we
 * hear about it instead of David silently approving a wrong price.
 *
 * No intelligence required: these are equality/sign assertions, not judgment
 * calls. The judgment layer (is a cost believable?) is the plausibility filter.
 *
 * Read-only — never mutates. Returns a list of violations for the caller to alert on.
 */

export interface Violation {
  invariant: string   // short code, e.g. "STALE_PRICE"
  product:   string
  detail:    string
}

type Row = {
  id: string
  status: string
  suggested_retail_price: number
  margin_warning: boolean
  product: {
    name: string
    is_active: boolean
    purchase_cost: number | null
    price_multiplier: number | null
    market_ceiling: number | null
    margin_floor: number | null
  } | null
}

/** The price the engine WOULD compute right now for this product (pence). */
function expectedPrice(cost: number, mult: number, ceiling: number | null): number {
  const raw = Math.round(cost * mult)
  return ceiling ? Math.min(raw, ceiling) : raw
}

export async function checkPricingInvariants(supabase: SupabaseClient): Promise<Violation[]> {
  const { data, error } = await supabase
    .from('price_suggestions')
    .select('id, status, suggested_retail_price, margin_warning, product:products(name, is_active, purchase_cost, price_multiplier, market_ceiling, margin_floor)')
    .in('status', ['pending', 'withheld'])

  if (error) throw new Error(`invariant query failed: ${error.message}`)

  const rows = (data ?? []) as unknown as Row[]
  const violations: Violation[] = []
  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`

  for (const r of rows) {
    const p = r.product
    const name = p?.name ?? '(unknown product)'

    // D — orphaned: a live suggestion pointing at an inactive/missing product.
    if (!p || p.is_active === false) {
      violations.push({ invariant: 'ORPHANED', product: name, detail: `${r.status} suggestion for an inactive/missing product — should have been cleared.` })
      continue
    }

    const cost    = p.purchase_cost ?? 0
    const mult    = p.price_multiplier ?? 2
    const ceiling = p.market_ceiling
    const floor   = p.margin_floor ?? 0.2

    if (cost <= 0) {
      violations.push({ invariant: 'NO_COST', product: name, detail: `${r.status} suggestion but product has no purchase_cost — cannot be validated or priced.` })
      continue
    }

    // A — STALE: stored price disagrees with cost × multiplier (capped). The exact bug we fixed.
    const expected = expectedPrice(cost, mult, ceiling)
    if (r.suggested_retail_price !== expected) {
      violations.push({
        invariant: 'STALE_PRICE',
        product: name,
        detail: `${r.status} suggests ${gbp(r.suggested_retail_price)} but cost ${gbp(cost)} × ${mult}${ceiling ? ` (capped ${gbp(ceiling)})` : ''} = ${gbp(expected)}. Row is stale.`,
      })
    }

    // B — at/below cost: would lose money on every sale.
    if (r.suggested_retail_price <= cost) {
      violations.push({ invariant: 'AT_OR_BELOW_COST', product: name, detail: `${r.status} price ${gbp(r.suggested_retail_price)} ≤ cost ${gbp(cost)}.` })
    }

    // C — flag drift: margin_warning must equal "this price is below floor", because
    //     Approve All trusts that flag to exclude below-floor rows from bulk approval.
    const margin = r.suggested_retail_price > 0 ? (r.suggested_retail_price - cost) / r.suggested_retail_price : 0
    const shouldWarn = margin < floor
    if (r.status === 'pending' && shouldWarn !== r.margin_warning) {
      violations.push({
        invariant: 'FLOOR_FLAG_DRIFT',
        product: name,
        detail: `margin ${(margin * 100).toFixed(1)}% vs floor ${(floor * 100).toFixed(0)}% ⇒ should${shouldWarn ? '' : ' NOT'} warn, but margin_warning=${r.margin_warning}. ${shouldWarn ? 'A below-floor row could be swept into Approve All.' : ''}`,
      })
    }
  }

  return violations
}
