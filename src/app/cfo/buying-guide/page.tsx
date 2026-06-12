import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ProfitChart } from './MarginChart'
import { GuideTabs } from './GuideTabs'

export const dynamic = 'force-dynamic'

function fmtMoney(pence: number) {
  return pence < 0
    ? `-£${(Math.abs(pence) / 100).toFixed(0)}`
    : `£${(pence / 100).toFixed(0)}`
}

function returnLabel(ratio: number): { emoji: string; action: string; colour: string } {
  if (ratio >= 3.0)  return { emoji: '🟢', action: 'Buy as much as you can',      colour: 'text-green-700' }
  if (ratio >= 2.0)  return { emoji: '🟢', action: 'Strong earner — stock up',    colour: 'text-green-600' }
  if (ratio >= 1.5)  return { emoji: '🟡', action: 'Good — buy regularly',        colour: 'text-yellow-700' }
  if (ratio >= 1.25) return { emoji: '🟡', action: 'Decent — worth buying',       colour: 'text-yellow-600' }
  if (ratio >= 1.0)  return { emoji: '🟠', action: 'Thin margin — buy carefully', colour: 'text-orange-600' }
  return               { emoji: '🔴', action: 'LOSING MONEY — reconsider',        colour: 'text-red-600' }
}

export default async function BuyingGuidePage() {
  const supabase = await createClient()

  // Pull all linked sales data
  const { data: salesRows } = await supabase
    .from('sales_data')
    .select('product_id, quantity_sold, revenue')
    .eq('source', 'epos_month_import')
    .not('product_id', 'is', null)

  const { data: products } = await supabase
    .from('products')
    .select('id, name, purchase_cost, unit, retail_price, is_loss_leader, needs_review, weekly_units, weekly_units_recent')
    .eq('is_active', true)
    .gt('purchase_cost', 0)

  // No EPOS sales volumes yet → rank by per-item margin (retail vs cost).
  // Still real, useful guidance: which products earn most per sale. Total-£
  // profit (volume-weighted) needs an EPOS sales upload.
  if (!salesRows || salesRows.length === 0) {
    const u = (p: number) => p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`

    type M = {
      name: string; cost: number; retail: number; marginPct: number; ratio: number
      lossLeader: boolean; needsReview: boolean; weeklyUnits: number; weeklyProfit: number
    }
    const rows: M[] = (products ?? [])
      .filter(p => p.purchase_cost > 0 && p.retail_price > 0)
      .map(p => {
        // Prefer the in-season rate (June 2026 till data) over the 283-week blend.
        const weeklyUnits = p.weekly_units_recent ?? p.weekly_units ?? 0
        return {
          name:         p.name,
          cost:         p.purchase_cost,
          retail:       p.retail_price,
          marginPct:    (p.retail_price - p.purchase_cost) / p.retail_price,
          ratio:        p.retail_price / p.purchase_cost,
          lossLeader:   !!p.is_loss_leader,
          needsReview:  !!p.needs_review,
          weeklyUnits,
          // "Where to put your money" = margin × volume, not margin alone.
          weeklyProfit: (p.retail_price - p.purchase_cost) * weeklyUnits,
        }
      })

    // Quarantine = the curated needs_review flag, full stop. It's the SINGLE
    // source of truth, kept in lock-step with David's question list, so the two
    // never drift. (A bare >75% margin isn't reliable either way — sack potatoes
    // hit 78% legitimately, while a wrong cost can land at a believable 74%.)
    const needsCheck  = rows.filter(r => !r.lossLeader && r.needsReview)
    const rest        = rows.filter(r => !r.lossLeader && !r.needsReview)
    const losing      = rest.filter(r => r.marginPct < 0)
    // Thin margins ranked by VOLUME — a thin margin on 200/week is urgent,
    // on 2/week it's trivia.
    const thin        = rest.filter(r => r.marginPct >= 0 && r.marginPct < 0.20)
                            .sort((a, b) => b.weeklyUnits - a.weeklyUnits)
    const healthy     = rest.filter(r => r.marginPct >= 0.20)
    const byProfit    = (a: M, b: M) => b.weeklyProfit - a.weeklyProfit
    const big         = healthy.filter(r => r.weeklyUnits > 0 && r.weeklyProfit >= 2500).sort(byProfit)
    const steady      = healthy.filter(r => r.weeklyUnits > 0 && r.weeklyProfit >= 500 && r.weeklyProfit < 2500).sort(byProfit)
    const small       = healthy.filter(r => r.weeklyUnits > 0 && r.weeklyProfit < 500).sort(byProfit)
    const noVolume    = healthy.filter(r => r.weeklyUnits === 0).sort((a, b) => b.marginPct - a.marginPct)
    const lossLeaders = rows.filter(r => r.lossLeader)
    const chartData   = [...big, ...steady].slice(0, 10)
      .map(r => ({ name: r.name, profitPence: r.weeklyProfit, marginPct: r.marginPct }))

    const Line = ({ r, tone }: { r: M; tone: string }) => (
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{r.name}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            cost {u(r.cost)} · sell {u(r.retail)} · £1 in → £{r.ratio.toFixed(2)} back
          </p>
        </div>
        <p className={`font-bold text-sm shrink-0 tabular-nums ${tone}`}>{Math.round(r.marginPct * 100)}%</p>
      </div>
    )

    const totalWeekly = [...big, ...steady, ...small].reduce((s, r) => s + r.weeklyProfit, 0)

    return (
      <div className="page pb-24">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/cfo" className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">←</Link>
          <div>
            <h1 className="text-xl font-bold">Where to put your money</h1>
            <p className="text-xs text-[var(--text-muted)]">Ranked by estimated £ profit per week — margin × how fast it sells</p>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="card mb-6">
            <p className="section-title">Top earners — estimated profit per week</p>
            <ProfitChart data={chartData} />
            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              Bar length = £ earned per week · colour = margin health (green strong, amber thin).
              Est. total across all products: <strong>£{Math.round(totalWeekly / 100)}/week</strong>.
            </p>
          </div>
        )}

        {needsCheck.length > 0 && (
          <section className="mb-6">
            <p className="section-title text-status-amber">⚠ Cost not yet confirmed ({needsCheck.length})</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Cost or selling unit still being checked with David — so the margin here
              isn&apos;t reliable yet (even where it looks normal). Don&apos;t act on these %.
            </p>
            <div className="rounded-xl border border-white/10 bg-[var(--bg-card)] divide-y divide-white/5 overflow-hidden">{needsCheck.map(r => <Line key={r.name} r={r} tone="text-status-amber" />)}</div>
          </section>
        )}

        {thin.length > 0 && (
          <section className="mb-6">
            <p className="section-title text-status-amber">Thin margins — biggest sellers first</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Under 20% margin. The faster it sells, the more a small price rise is worth.
            </p>
            <div className="rounded-xl border border-white/10 bg-[var(--bg-card)] divide-y divide-white/5 overflow-hidden">{thin.map(r => (
              <div key={r.name} className="px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {r.weeklyUnits > 0 ? `sells ~${r.weeklyUnits}/wk · ` : ''}cost {u(r.cost)} · sell {u(r.retail)}
                  </p>
                </div>
                <p className="font-bold text-sm shrink-0 tabular-nums text-status-amber">{Math.round(r.marginPct * 100)}%</p>
              </div>
            ))}</div>
          </section>
        )}

        {losing.length > 0 && (
          <section className="mb-6">
            <p className="section-title text-status-red">Losing money — needs a price rise</p>
            <div className="rounded-xl border border-white/10 bg-[var(--bg-card)] divide-y divide-white/5 overflow-hidden">{losing.map(r => <Line key={r.name} r={r} tone="text-status-red" />)}</div>
          </section>
        )}

        <p className="section-title">Where the money is</p>
        <GuideTabs big={big} steady={steady} small={small} noVolume={noVolume} lossLeaders={lossLeaders} />

        <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
          Sales rates: June 2026 till data where available (1–12 Jun), else long-run average.
          Treat the £/week as a guide, not gospel.
        </p>
      </div>
    )
  }

  // Aggregate sales by product
  const prodMap = new Map((products ?? []).map(p => [p.id, p]))
  const agg = new Map<string, { revenue: number; qty: number }>()

  for (const row of salesRows) {
    if (!row.product_id) continue
    const existing = agg.get(row.product_id) ?? { revenue: 0, qty: 0 }
    existing.revenue += row.revenue
    existing.qty     += row.quantity_sold
    agg.set(row.product_id, existing)
  }

  // Calculate profit and return-on-spend per product
  type Row = {
    name:       string
    revenue:    number   // pence
    cost:       number   // pence
    profit:     number   // pence
    ratio:      number   // revenue / cost (e.g. 2.3 = get £2.30 back per £1 spent)
  }

  const rows: Row[] = []
  for (const [productId, { revenue, qty }] of agg.entries()) {
    const p = prodMap.get(productId)
    if (!p || p.purchase_cost <= 0) continue
    if (revenue < 500) continue   // ignore trivial amounts (< £5)

    const cost   = Math.round(qty * p.purchase_cost)
    if (cost <= 0) continue
    const profit = revenue - cost
    const ratio  = revenue / cost

    rows.push({ name: p.name, revenue, cost, profit, ratio })
  }

  rows.sort((a, b) => b.profit - a.profit)

  const winners  = rows.filter(r => r.ratio >= 1.5)
  const ok       = rows.filter(r => r.ratio >= 1.0 && r.ratio < 1.5)
  const losers   = rows.filter(r => r.ratio < 1.0)
  const totalProfit  = rows.reduce((s, r) => s + r.profit, 0)
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cfo" className="text-brand-accent min-h-[48px] min-w-[48px]
                                      flex items-center justify-center text-xl">←</Link>
        <div>
          <h1 className="text-xl font-bold">Where to put your money</h1>
          <p className="text-xs text-[var(--text-muted)]">Based on your EPOS sales data</p>
        </div>
      </div>

      {/* Summary */}
      <div className="card mb-6 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-status-green">{fmtMoney(totalProfit)}</p>
          <p className="text-xs text-[var(--text-muted)]">Total profit on linked products</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{fmtMoney(totalRevenue)}</p>
          <p className="text-xs text-[var(--text-muted)]">Total revenue</p>
        </div>
      </div>

      {/* Winners */}
      {winners.length > 0 && (
        <section className="mb-6">
          <p className="section-title">Working hardest for you</p>
          <div className="space-y-3">
            {winners.map(r => {
              const { emoji, action, colour } = returnLabel(r.ratio)
              return (
                <div key={r.name} className="card">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-bold text-base">{r.name}</p>
                    <p className="text-status-green font-bold text-lg shrink-0">
                      {fmtMoney(r.profit)} profit
                    </p>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">
                    For every <strong>£1</strong> you spend buying it, you get{' '}
                    <strong className="text-status-green">£{r.ratio.toFixed(2)}</strong> back at the till.
                  </p>
                  <p className={`text-xs font-semibold ${colour}`}>{emoji} {action}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* OK products */}
      {ok.length > 0 && (
        <section className="mb-6">
          <p className="section-title">Thin but positive</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            These are making money but not a lot. Worth buying, but don't overspend on them.
          </p>
          <div className="space-y-3">
            {ok.map(r => {
              const { emoji, action, colour } = returnLabel(r.ratio)
              return (
                <div key={r.name} className="card border border-status-amber/20">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-bold text-base">{r.name}</p>
                    <p className="text-status-amber font-bold text-lg shrink-0">
                      {fmtMoney(r.profit)} profit
                    </p>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">
                    For every <strong>£1</strong> you spend buying it, you get{' '}
                    <strong>£{r.ratio.toFixed(2)}</strong> back at the till.
                  </p>
                  <p className={`text-xs font-semibold ${colour}`}>{emoji} {action}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Losers */}
      {losers.length > 0 && (
        <section className="mb-6">
          <p className="section-title text-status-red">Losing money</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Every time you buy these, you sell them for less than you paid.
            Only stock them if they bring customers in who then buy other things.
          </p>
          <div className="space-y-3">
            {losers.map(r => {
              const { emoji, action, colour } = returnLabel(r.ratio)
              return (
                <div key={r.name} className="card border border-status-red/30">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-bold text-base">{r.name}</p>
                    <p className="text-status-red font-bold text-lg shrink-0">
                      {fmtMoney(r.profit)} loss
                    </p>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mb-1">
                    For every <strong>£1</strong> you spend buying it, you only get{' '}
                    <strong className="text-status-red">£{r.ratio.toFixed(2)}</strong> back at the till.
                  </p>
                  <p className={`text-xs font-semibold ${colour}`}>{emoji} {action}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center mt-4">
        Based on EPOS sales data × your confirmed purchase costs.
        Upload a new sales report on the Sync page to refresh.
      </p>

    </div>
  )
}
