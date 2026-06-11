import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(iso: string | null) {
  if (!iso) return 'no date'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function groupLabel(iso: string | null): string {
  if (!iso) return 'No delivery date'
  const d = new Date(iso + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  if (diff < 0)  return `⚠️ Overdue · ${dateStr}`
  if (diff === 0) return `Today · ${dateStr}`
  if (diff === 1) return `Tomorrow · ${dateStr}`
  return dateStr
}

export default async function DispatchPage() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select(`
      id,
      order_date,
      delivery_date,
      customer:wholesale_customers(name),
      items:wholesale_order_items(
        id, product_id, quantity, unit_type, unit_price,
        product:products(id, name)
      )
    `)
    .eq('status', 'confirmed')
    .order('delivery_date', { ascending: true, nullsFirst: false })

  const { data: lastPrices } = await supabase
    .from('product_supplier_last_price')
    .select('product_id, last_date')

  const lastPurchaseMap = new Map<string, string>()
  for (const row of lastPrices ?? []) {
    const existing = lastPurchaseMap.get(row.product_id)
    if (!existing || row.last_date > existing) {
      lastPurchaseMap.set(row.product_id, row.last_date)
    }
  }

  const orderList = (orders ?? []) as any[]
  const firstOrderId = orderList[0]?.id ?? null

  // Aggregate quantities per product across all orders
  const productMap = new Map<string, { name: string; qty: number; ageDays: number | null }>()
  for (const order of orderList) {
    for (const item of (order.items ?? []) as any[]) {
      const pid = item.product_id
      const ld = lastPurchaseMap.get(pid) ?? null
      const ageDays = ld ? Math.floor((Date.now() - new Date(ld).getTime()) / 86400000) : null
      const ex = productMap.get(pid)
      if (ex) {
        ex.qty += Number(item.quantity)
      } else {
        productMap.set(pid, {
          name:    (item.product as any)?.name ?? 'Unknown',
          qty:     Number(item.quantity),
          ageDays,
        })
      }
    }
  }

  const productRows = Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Group orders by delivery date (orderList is already sorted ascending = nearest first)
  const dateGroups: { date: string | null; orders: any[] }[] = []
  for (const o of orderList) {
    const last = dateGroups[dateGroups.length - 1]
    if (last && last.date === o.delivery_date) last.orders.push(o)
    else dateGroups.push({ date: o.delivery_date, orders: [o] })
  }

  return (
    <div className="page pb-44">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-[var(--text-muted)] text-2xl leading-none">←</Link>
        <div>
          <h1 className="text-xl font-bold">Dispatch</h1>
          <p className="text-xs text-[var(--text-muted)]">{orderList.length} {orderList.length === 1 ? 'delivery' : 'deliveries'} to go</p>
        </div>
      </div>

      {orderList.length === 0 ? (
        <div className="card text-center py-10 space-y-4">
          <p className="text-[var(--text-muted)]">No confirmed orders to deliver</p>
          <Link href="/order" className="btn-primary inline-block">Place an order</Link>
        </div>
      ) : (
        <>
          {dateGroups.map(g => (
            <div key={g.date ?? 'none'} className="mb-5">
              <p className="section-title">{groupLabel(g.date)} · {g.orders.length}</p>
              <div className="space-y-2">
                {g.orders.map((o: any) => {
                  const total = (o.items ?? []).reduce(
                    (s: number, i: any) => s + Math.round(Number(i.quantity) * i.unit_price), 0
                  )
                  return (
                    <Link key={o.id} href={`/dispatch/${o.id}`}
                      className="card flex items-center justify-between active:opacity-70 transition-opacity">
                      <div>
                        <p className="font-semibold">{(o.customer as any)?.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">ordered {fmtDate(o.order_date)}</p>
                      </div>
                      <p className="font-bold text-brand-accent">{pence(total)}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          <p className="section-title">Load checklist</p>
          <div className="space-y-2 mb-8">
            {productRows.map((row, i) => {
              const stale = row.ageDays !== null && row.ageDays >= 2
              return (
                <div key={i}
                  className={`card flex items-center justify-between ${stale ? 'border border-status-amber/50' : ''}`}>
                  <div>
                    <p className="font-medium">{row.name}</p>
                    {stale && (
                      <p className="text-xs text-status-amber mt-0.5">
                        Last bought {row.ageDays}d ago — check shop for old stock
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-bold ml-4 shrink-0">
                    {row.qty % 1 === 0 ? row.qty : row.qty.toFixed(1)}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {firstOrderId && (
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10 z-40">
          <Link href={`/dispatch/${firstOrderId}`}
            className="btn-primary w-full py-5 text-lg font-semibold flex items-center justify-center rounded-xl">
            All loaded → Start deliveries
          </Link>
        </div>
      )}
    </div>
  )
}
