import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    .select('id, name, purchase_cost, unit, retail_price')
    .eq('is_active', true)
    .gt('purchase_cost', 0)

  if (!salesRows || salesRows.length === 0) {
    return (
      <div className="page pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cfo" className="text-brand-accent min-h-[48px] min-w-[48px]
                                        flex items-center justify-center text-xl">←</Link>
          <h1 className="text-xl font-bold">Where to put your money</h1>
        </div>
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">📊</p>
          <p className="font-semibold mb-2">No sales data yet</p>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Upload a Sales by Product report from EPOS Now and this page will show
            you exactly which products are making you money and which aren't.
          </p>
          <Link href="/sync" className="btn-primary px-6 py-3">
            Go to EPOS Sync →
          </Link>
        </div>
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
