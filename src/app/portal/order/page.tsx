import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderBuilder from './OrderBuilder'

export default async function PortalOrderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/portal/order')

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('portal_user_id', user.id)
    .single()

  if (!customer) {
    return (
      <div className="page text-center pt-20">
        <p className="text-[var(--text-muted)]">Your account is not linked to a wholesale customer.</p>
        <p className="text-[var(--text-muted)] text-sm mt-2">Please contact Fresh &amp; Fruity.</p>
      </div>
    )
  }

  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, order_date')
    .eq('customer_id', customer.id)
    .order('order_date', { ascending: false })

  const orderIds = (orders ?? []).map(o => o.id)
  // order_date drives "last bought", not the row's created_at: the historical
  // orders were bulk-imported and share clustered created_at values, which would
  // make "most recent unit" arbitrary among them.
  const orderDate = new Map((orders ?? []).map(o => [o.id, o.order_date as string]))

  type Fav = { product_id: string; name: string; unit: string; unit_type: string; times: number }
  type LastLine = { product_id: string; name: string; unit: string; unit_type: string; quantity: number }
  let favourites: Fav[] = []
  let lastOrder: LastLine[] = []

  if (orderIds.length) {
    const { data: items } = await supabase
      .from('wholesale_order_items')
      .select('order_id, product_id, quantity, unit_type, product:products(id, name, unit, is_active)')
      .in('order_id', orderIds)

    const byProduct = new Map<string, { p: any; orders: Set<string>; latestUnit: string; latestDate: string }>()
    for (const it of items ?? []) {
      const p = it.product as any
      if (!p || !p.is_active) continue
      const d = orderDate.get(it.order_id) ?? ''
      let rec = byProduct.get(it.product_id)
      if (!rec) { rec = { p, orders: new Set(), latestUnit: it.unit_type, latestDate: d }; byProduct.set(it.product_id, rec) }
      rec.orders.add(it.order_id)
      // Seed the line's default unit from however it was last actually bought.
      if (d > rec.latestDate) { rec.latestDate = d; rec.latestUnit = it.unit_type }
    }
    favourites = [...byProduct.values()]
      .sort((a, b) => b.orders.size - a.orders.size)
      .slice(0, 12)
      .map(r => ({ product_id: r.p.id, name: r.p.name, unit: r.p.unit, unit_type: r.latestUnit, times: r.orders.size }))

    const lastId = orderIds[0]
    lastOrder = (items ?? [])
      .filter(it => it.order_id === lastId && (it.product as any)?.is_active)
      .map(it => ({
        product_id: it.product_id,
        name: (it.product as any).name,
        unit: (it.product as any).unit,
        unit_type: it.unit_type,
        quantity: Number(it.quantity),
      }))
  }

  const lastOrderDate = orderIds.length ? orderDate.get(orderIds[0]) ?? null : null

  return <OrderBuilder customerName={customer.name} favourites={favourites} lastOrder={lastOrder} lastOrderDate={lastOrderDate} />
}
