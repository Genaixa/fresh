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
    margin_floor: number; weekly_units: number | null; category: string
  }
  type HistRow = { id: string; price_type: 'purchase' | 'retail'; new_price: number; old_price: number | null; reason: string | null; created_at: string }
  type TimelineEntry = {
    id: string
    date: string
    priceType: 'purchase' | 'retail' | 'both'
    cost: number
    retail: number
    oldCost: number
    oldRetail: number
    margin: number
    oldMargin: number
    reason: string | null
  }

  let product: Product | null = null
  let timeline: TimelineEntry[] = []

  if (product_id) {
    const { data: p } = await supabase
      .from('products')
      .select('id, name, retail_price, purchase_cost, margin_floor, weekly_units, category')
      .eq('id', product_id)
      .single()
    product = p

    const { data: rows } = await supabase
      .from('price_history')
      .select('id, price_type, new_price, old_price, reason, created_at')
      .eq('product_id', product_id)
      .order('created_at', { ascending: true })

    if (rows?.length && product) {
      // Reconstruct state forward from oldest change.
      // Seed initial state from the old_price of the earliest entry of each type.
      const firstPurchase = rows.find(r => r.price_type === 'purchase')
      const firstRetail   = rows.find(r => r.price_type === 'retail')
      let cost   = firstPurchase?.old_price ?? product.purchase_cost
      let retail = firstRetail?.old_price   ?? product.retail_price

      // Group entries that share the same minute (e.g. both cost+retail updated together)
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
          id:         group[0].id,
          date:       group[0].created_at,
          priceType,
          cost,
          retail,
          oldCost,
          oldRetail,
          margin:    retail > 0 ? (retail - cost) / retail : -99,
          oldMargin: oldRetail > 0 ? (oldRetail - oldCost) / oldRetail : -99,
          reason:    group[0].reason,
        })
      }

      // Newest first for display
      timeline.reverse()
    }
  }

  const floor = product?.margin_floor ?? 0.2
  const weeklyUnits = product?.weekly_units ?? 0

  function marginColour(m: number): string {
    if (m < 0)     return 'text-status-red'
    if (m < floor) return 'text-status-amber'
    return 'text-status-green'
  }
  function marginStatus(m: number): 'red' | 'amber' | 'green' | 'grey' {
    if (m < 0)     return 'red'
    if (m < floor) return 'amber'
    return 'green'
  }
  function pct(m: number) { return `${(m * 100).toFixed(1)}%` }
  function diff(n: number, o: number) {
    const d = n - o
    if (d === 0) return null
    return `${d > 0 ? '+' : ''}${formatPrice(Math.abs(d))}`
  }
  function sign(n: number, o: number) { return n > o ? '↑' : n < o ? '↓' : '=' }

  const currentMargin = product
    ? (product.retail_price - product.purchase_cost) / product.retail_price
    : 0
  const weeklyProfit = weeklyUnits > 0 && product
    ? (product.retail_price - product.purchase_cost) * weeklyUnits
    : null

  // 4-week avg cost from history
  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000
  const recentCosts = timeline.filter(t => new Date(t.date).getTime() >= fourWeeksAgo).map(t => t.cost)
  const avg4wk = recentCosts.length
    ? Math.round(recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length)
    : product?.purchase_cost ?? 0

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
          {/* Current state summary */}
          <div className="card mb-2">
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
                <p className={`text-lg font-bold ${marginColour(currentMargin)}`}>
                  {pct(currentMargin)}
                </p>
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
          </div>

          {timeline.length === 0 && (
            <p className="text-center text-[var(--text-muted)] py-8 text-sm">
              No price changes recorded yet.
            </p>
          )}

          {timeline.length > 0 && (
            <div className="space-y-2 mt-4">
              {timeline.map(t => {
                const atLoss    = t.cost > t.retail
                const atOldLoss = t.oldCost > t.oldRetail
                const weeklyGain = weeklyUnits > 0
                  ? (t.retail - t.cost) * weeklyUnits : null
                const costChange   = diff(t.cost,   t.oldCost)
                const retailChange = diff(t.retail, t.oldRetail)
                const marginChange = t.margin - t.oldMargin
                const dateStr = new Date(t.date).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })

                return (
                  <div key={t.id} className="card border border-white/8">
                    {/* Date + what changed */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">{dateStr}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${t.priceType === 'purchase' ? 'bg-white/10 text-[var(--text-muted)]'
                        : t.priceType === 'retail'   ? 'bg-brand-accent/20 text-brand-accent'
                        :                              'bg-white/10 text-[var(--text-muted)]'}`}>
                        {t.priceType === 'purchase' ? 'Cost changed'
                        : t.priceType === 'retail'  ? 'Retail changed'
                        :                             'Both changed'}
                      </span>
                    </div>

                    {/* Cost + Retail two-col */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-xl bg-white/5 p-2.5">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Cost</p>
                        <p className="font-bold">{formatPrice(t.cost)}</p>
                        {costChange && (
                          <p className={`text-xs mt-0.5 ${sign(t.cost, t.oldCost) === '↑' ? 'text-status-red' : 'text-status-green'}`}>
                            {sign(t.cost, t.oldCost)} {costChange} from {formatPrice(t.oldCost)}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-white/5 p-2.5">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Retail</p>
                        <p className="font-bold">{formatPrice(t.retail)}</p>
                        {retailChange && (
                          <p className={`text-xs mt-0.5 ${sign(t.retail, t.oldRetail) === '↑' ? 'text-status-green' : 'text-status-amber'}`}>
                            {sign(t.retail, t.oldRetail)} {retailChange} from {formatPrice(t.oldRetail)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Margin row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrafficDot status={marginStatus(t.margin)} />
                        <span className={`font-semibold text-sm ${marginColour(t.margin)}`}>
                          {atLoss ? 'At a loss' : `${pct(t.margin)} margin`}
                        </span>
                      </div>
                      {marginChange !== 0 && !atOldLoss && (
                        <span className={`text-xs ${marginChange > 0 ? 'text-status-green' : 'text-status-red'}`}>
                          {marginChange > 0 ? '+' : ''}{(marginChange * 100).toFixed(1)}pp
                        </span>
                      )}
                    </div>

                    {/* Weekly P&L */}
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
