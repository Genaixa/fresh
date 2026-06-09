import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/pricing-engine'
import { TrafficDot } from '@/components/ui/TrafficDot'
import { ProductSelector } from './ProductSelector'

export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>
}) {
  const { product_id } = await searchParams
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  type Product = {
    id: string; name: string; retail_price: number; purchase_cost: number
    margin_floor: number; weekly_units: number | null; case_size: number | null
  }
  type HistRow = {
    id: string; price_type: 'purchase' | 'retail'
    new_price: number; old_price: number | null; reason: string | null; created_at: string
  }
  type DeliveryRow = {
    id: string; invoice_date: string; supplier_name: string
    invoice_number: string | null; unit_cost: number; units_per_case: number | null
  }
  type TimelineEntry = {
    id: string; date: string
    priceType: 'purchase' | 'retail' | 'both'
    cost: number; retail: number
    oldCost: number; oldRetail: number
    margin: number; oldMargin: number
    reason: string | null
  }

  let product: Product | null = null
  let timeline: TimelineEntry[] = []
  let deliveries: (DeliveryRow & { perUnit: number })[] = []

  if (product_id) {
    const { data: p } = await supabase
      .from('products')
      .select('id, name, retail_price, purchase_cost, margin_floor, weekly_units, case_size')
      .eq('id', product_id)
      .single()
    product = p

    // ── System-tracked price changes ─────────────────────────────────────────
    const { data: rows } = await supabase
      .from('price_history')
      .select('id, price_type, new_price, old_price, reason, created_at')
      .eq('product_id', product_id)
      .order('created_at', { ascending: true })

    if (rows?.length && product) {
      const firstPurchase = rows.find(r => r.price_type === 'purchase')
      const firstRetail   = rows.find(r => r.price_type === 'retail')
      let cost   = firstPurchase?.old_price ?? product.purchase_cost
      let retail = firstRetail?.old_price   ?? product.retail_price

      const grouped: HistRow[][] = []
      for (const row of rows as HistRow[]) {
        const last = grouped[grouped.length - 1]
        const sameMinute = last && Math.abs(
          new Date(row.created_at).getTime() - new Date(last[0].created_at).getTime()
        ) < 60_000
        if (sameMinute) last.push(row)
        else grouped.push([row])
      }

      for (const group of grouped) {
        const oldCost   = cost
        const oldRetail = retail
        let priceType: 'purchase' | 'retail' | 'both' = group[0].price_type
        for (const row of group) {
          if (row.price_type === 'purchase') cost   = row.new_price
          else                               retail = row.new_price
        }
        if (group.length > 1) priceType = 'both'

        timeline.push({
          id: group[0].id, date: group[0].created_at, priceType,
          cost, retail, oldCost, oldRetail,
          margin:    retail > 0 ? (retail - cost) / retail : -99,
          oldMargin: oldRetail > 0 ? (oldRetail - oldCost) / oldRetail : -99,
          reason:    group[0].reason,
        })
      }
      timeline.reverse()
    }

    // ── Invoice delivery history (full historical cost) ───────────────────────
    const { data: invItems } = await supabase
      .from('purchase_invoice_items')
      .select(`
        id, unit_cost, units_per_case,
        invoice:purchase_invoices!inner(invoice_date, supplier_name, invoice_number)
      `)
      .eq('product_id', product_id)
      .eq('is_matched', true)
      .order('invoice(invoice_date)', { ascending: false })
      .limit(200)

    const caseSize = product?.case_size ?? 1
    deliveries = (invItems ?? []).map(item => {
      const inv = item.invoice as unknown as { invoice_date: string; supplier_name: string; invoice_number: string | null }
      const divisor = item.units_per_case && item.units_per_case > 1
        ? item.units_per_case
        : caseSize
      return {
        id:             item.id,
        invoice_date:   inv.invoice_date,
        supplier_name:  inv.supplier_name,
        invoice_number: inv.invoice_number,
        unit_cost:      item.unit_cost,
        units_per_case: item.units_per_case,
        perUnit:        Math.round(item.unit_cost / divisor),
      }
    })
  }

  const floor        = product?.margin_floor ?? 0.2
  const weeklyUnits  = product?.weekly_units ?? 0
  const currentMargin = product
    ? (product.retail_price - product.purchase_cost) / product.retail_price
    : 0
  const weeklyProfit = weeklyUnits > 0 && product
    ? (product.retail_price - product.purchase_cost) * weeklyUnits
    : null

  const retailPrice = product?.retail_price ?? 0

  // 4-week avg — exclude deliveries where per-unit cost > retail (per-case data errors)
  const fourWeeksAgo  = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
  const validDeliveries   = deliveries.filter(d => retailPrice === 0 || d.perUnit <= retailPrice)
  const recentDeliveries  = validDeliveries.filter(d => new Date(d.invoice_date) >= fourWeeksAgo)
  const avg4wk = recentDeliveries.length
    ? Math.round(recentDeliveries.reduce((s, d) => s + d.perUnit, 0) / recentDeliveries.length)
    : product?.purchase_cost ?? 0

  // Cost trend — valid deliveries only, first half vs second half
  const allCosts = [...validDeliveries].reverse().map(d => d.perUnit)
  const half   = Math.floor(allCosts.length / 2)
  const oldAvg = half > 0 ? allCosts.slice(0, half).reduce((a, b) => a + b, 0) / half : null
  const newAvg = half > 0 ? allCosts.slice(half).reduce((a, b) => a + b, 0) / (allCosts.length - half) : null
  const trendPct = oldAvg && newAvg ? Math.round((newAvg / oldAvg - 1) * 100) : null

  // Count bad delivery entries so we can note them
  const badDeliveryCount = deliveries.length - validDeliveries.length

  function mc(m: number) {
    if (m < 0)     return 'text-status-red'
    if (m < floor) return 'text-status-amber'
    return 'text-status-green'
  }
  function ms(m: number): 'red' | 'amber' | 'green' | 'grey' {
    if (m < 0)     return 'red'
    if (m < floor) return 'amber'
    return 'green'
  }
  function pct(m: number) { return `${(m * 100).toFixed(1)}%` }
  function sign(a: number, b: number) { return a > b ? '↑' : a < b ? '↓' : '—' }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Price History</h1>
      </div>

      <div className="mb-5">
        <ProductSelector products={products ?? []} selectedId={product_id} />
      </div>

      {product && (
        <>
          {/* Current state */}
          <div className="card mb-4">
            <p className="text-xs text-[var(--text-muted)] mb-3 font-medium uppercase tracking-wide">Current</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Cost</p>
                <p className="text-lg font-bold">{formatPrice(product.purchase_cost)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Retail</p>
                <p className="text-lg font-bold">{formatPrice(product.retail_price)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Margin</p>
                <p className={`text-lg font-bold ${mc(currentMargin)}`}>{pct(currentMargin)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <div>
                <p className="text-xs text-[var(--text-muted)]">4-wk avg cost</p>
                <p className="font-semibold">{formatPrice(avg4wk)}</p>
              </div>
              {weeklyProfit !== null && (
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Weekly profit</p>
                  <p className={`font-semibold ${weeklyProfit >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                    {weeklyProfit >= 0 ? '+' : ''}{formatPrice(weeklyProfit)}/wk
                    <span className="text-xs text-[var(--text-muted)] ml-1">({weeklyUnits} units)</span>
                  </p>
                </div>
              )}
            </div>
            {weeklyUnits > 0 && (
              <div className="pt-3 border-t border-white/10 mt-3">
                <p className="text-xs text-[var(--text-muted)] mb-2">Avg sales volume</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Day',   val: (weeklyUnits / 7).toFixed(1) },
                    { label: 'Week',  val: weeklyUnits.toString() },
                    { label: 'Month', val: Math.round(weeklyUnits * 52 / 12).toString() },
                    { label: 'Year',  val: (weeklyUnits * 52).toLocaleString() },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs text-[var(--text-muted)]">{label}</p>
                      <p className="font-semibold text-sm">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {trendPct !== null && Math.abs(trendPct) >= 5 && (
              <p className={`text-xs mt-2 pt-2 border-t border-white/10
                ${trendPct > 0 ? 'text-status-amber' : 'text-status-green'}`}>
                Long-term cost trend: {trendPct > 0 ? '+' : ''}{trendPct}% over {deliveries.length} deliveries
              </p>
            )}
          </div>

          {/* System-tracked price changes */}
          {timeline.length > 0 && (
            <>
              <p className="section-title mb-2">Price changes</p>
              <div className="space-y-2 mb-6">
                {timeline.map(t => {
                  const atLoss        = t.cost > t.retail && t.retail > 0
                  const atOldLoss     = t.oldCost > t.oldRetail && t.oldRetail > 0
                  const isDataError   = atLoss  // cost > retail = pipeline bug, now guarded
                  const weeklyGain    = weeklyUnits > 0 ? (t.retail - t.cost) * weeklyUnits : null
                  const marginChange  = t.margin - t.oldMargin
                  const oldStateValid = t.oldCost > 0 && t.oldRetail > 0
                  const dateStr = new Date(t.date).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })
                  return (
                    <div key={t.id} className={`card border ${isDataError ? 'border-status-red/20 bg-status-red/5 opacity-60' : 'border-white/8'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">{dateStr}</p>
                        {isDataError ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-status-red/20 text-status-red">
                            Data error (corrected)
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${t.priceType === 'retail' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-white/10 text-[var(--text-muted)]'}`}>
                            {t.priceType === 'purchase' ? 'Cost changed' : t.priceType === 'retail' ? 'Retail changed' : 'Both changed'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-xl bg-white/5 p-2.5">
                          <p className="text-xs text-[var(--text-muted)] mb-1">Cost</p>
                          <p className="font-bold">{formatPrice(t.cost)}</p>
                          {t.cost !== t.oldCost && (
                            t.oldCost === 0
                              ? <p className="text-xs text-[var(--text-muted)] mt-0.5">First set</p>
                              : <p className={`text-xs mt-0.5 ${sign(t.cost, t.oldCost) === '↑' ? 'text-status-red' : 'text-status-green'}`}>
                                  {sign(t.cost, t.oldCost)} {formatPrice(Math.abs(t.cost - t.oldCost))} from {formatPrice(t.oldCost)}
                                </p>
                          )}
                        </div>
                        <div className="rounded-xl bg-white/5 p-2.5">
                          <p className="text-xs text-[var(--text-muted)] mb-1">Retail</p>
                          <p className="font-bold">{formatPrice(t.retail)}</p>
                          {t.retail !== t.oldRetail && (
                            t.oldRetail === 0
                              ? <p className="text-xs text-[var(--text-muted)] mt-0.5">First set</p>
                              : <p className={`text-xs mt-0.5 ${sign(t.retail, t.oldRetail) === '↑' ? 'text-status-green' : 'text-status-amber'}`}>
                                  {sign(t.retail, t.oldRetail)} {formatPrice(Math.abs(t.retail - t.oldRetail))} from {formatPrice(t.oldRetail)}
                                </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrafficDot status={ms(t.margin)} />
                          <span className={`font-semibold text-sm ${mc(t.margin)}`}>
                            {atLoss ? 'At a loss' : `${pct(t.margin)} margin`}
                          </span>
                        </div>
                        {oldStateValid && !atOldLoss && marginChange !== 0 && (
                          <span className={`text-xs ${marginChange > 0 ? 'text-status-green' : 'text-status-red'}`}>
                            {marginChange > 0 ? '+' : ''}{(marginChange * 100).toFixed(1)}pp
                          </span>
                        )}
                      </div>
                      {weeklyGain !== null && (
                        <p className={`text-xs ${weeklyGain >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                          {weeklyGain >= 0 ? '+' : ''}{formatPrice(weeklyGain)}/wk at this price
                          <span className="text-[var(--text-muted)]"> · {weeklyUnits} units/wk</span>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Full delivery cost history */}
          {deliveries.length > 0 && (() => {
            const thisMonthStart = new Date()
            thisMonthStart.setDate(1)
            thisMonthStart.setHours(0, 0, 0, 0)
            const thisMonth = deliveries.filter(d => new Date(d.invoice_date) >= thisMonthStart)
            const older     = deliveries.filter(d => new Date(d.invoice_date) <  thisMonthStart)

            function DeliveryCard({ d, i }: { d: typeof deliveries[0]; i: number }) {
              const isDataErr = retailPrice > 0 && d.perUnit > retailPrice
              const margin   = product!.retail_price > 0
                ? (product!.retail_price - d.perUnit) / product!.retail_price : -99
              const vsAvg    = avg4wk > 0 ? Math.round((d.perUnit / avg4wk - 1) * 100) : 0
              const prevCost = deliveries[i + 1]?.perUnit ?? null
              const dateStr  = new Date(d.invoice_date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              return (
                <div className={`card border ${isDataErr ? 'border-status-red/20 bg-status-red/5 opacity-60' : 'border-white/8'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{dateStr}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {d.supplier_name}
                        {d.invoice_number ? ` · ${d.invoice_number}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${isDataErr ? 'text-status-red line-through' : ''}`}>{formatPrice(d.perUnit)}</p>
                      {isDataErr ? (
                        <p className="text-xs text-status-red">Data error</p>
                      ) : prevCost !== null && d.perUnit !== prevCost && (
                        <p className={`text-xs ${d.perUnit > prevCost ? 'text-status-red' : 'text-status-green'}`}>
                          {sign(d.perUnit, prevCost)} {formatPrice(Math.abs(d.perUnit - prevCost))} vs prev
                        </p>
                      )}
                    </div>
                  </div>
                  {!isDataErr && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrafficDot status={ms(margin)} />
                        <span className={`text-sm ${mc(margin)}`}>
                          {margin < 0 ? 'At a loss' : `${pct(margin)} margin`}
                          <span className="text-xs text-[var(--text-muted)] ml-1">(vs {formatPrice(product!.retail_price)} retail)</span>
                        </span>
                      </div>
                      {Math.abs(vsAvg) >= 10 && (
                        <span className={`text-xs ${vsAvg > 0 ? 'text-status-amber' : 'text-status-green'}`}>
                          {vsAvg > 0 ? '+' : ''}{vsAvg}% vs 4-wk avg
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <>
                <p className="section-title mb-1">
                  Delivery cost history
                  <span className="text-[var(--text-muted)] font-normal ml-2 text-xs">
                    {deliveries.length} deliveries · back to {new Date(deliveries[deliveries.length - 1].invoice_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                </p>
                {badDeliveryCount > 0 && (
                  <p className="text-xs text-status-red mb-2">
                    {badDeliveryCount} {badDeliveryCount === 1 ? 'entry' : 'entries'} excluded from averages — cost exceeded retail price (data errors, shown struck-through)
                  </p>
                )}

                {thisMonth.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {thisMonth.map((d, i) => <DeliveryCard key={d.id} d={d} i={i} />)}
                  </div>
                )}

                {older.length > 0 && (
                  <details className="mb-4">
                    <summary className="text-sm text-[var(--text-muted)] cursor-pointer py-2 select-none list-none flex items-center gap-2">
                      <span className="text-xs border border-white/20 rounded px-2 py-0.5">Show {older.length} older deliveries</span>
                    </summary>
                    <div className="space-y-2 mt-2">
                      {older.map((d, i) => <DeliveryCard key={d.id} d={d} i={thisMonth.length + i} />)}
                    </div>
                  </details>
                )}
              </>
            )
          })()}

          {timeline.length === 0 && deliveries.length === 0 && (
            <p className="text-center text-[var(--text-muted)] py-8 text-sm">
              No price history recorded yet.
            </p>
          )}
        </>
      )}

      {!product && (
        <p className="text-center text-[var(--text-muted)] py-12 text-sm">
          Select a product to see its price history.
        </p>
      )}
    </div>
  )
}
