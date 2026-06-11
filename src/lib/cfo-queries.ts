import { createClient } from '@/lib/supabase/server'

export type TopCustomer = { id: string; name: string; revenue: number; orderCount: number }

/**
 * Wholesale sales revenue per customer over the last `weeks` weeks.
 * Returns ALL active external customers with revenue > 0, sorted high→low.
 * (Mirrors the aggregation used by the CFO page, exposed as a reusable query.)
 */
export async function topCustomers(weeks = 12): Promise<TopCustomer[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString().split('T')[0]

  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, customer_id')
    .gte('order_date', since)
    .in('status', ['confirmed', 'dispatched'])

  const { data: custs } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('is_active', true)
    .eq('is_internal', false)

  const orderIds = (orders ?? []).map(o => o.id)
  const rev = new Map<string, number>()
  const cnt = new Map<string, number>()

  if (orderIds.length) {
    const { data: items } = await supabase
      .from('wholesale_order_items')
      .select('order_id, quantity, unit_price')
      .in('order_id', orderIds)

    const o2c = new Map((orders ?? []).map(o => [o.id, o.customer_id]))
    for (const it of items ?? []) {
      const c = o2c.get(it.order_id)
      if (!c) continue
      rev.set(c, (rev.get(c) ?? 0) + Number(it.quantity) * it.unit_price)
      cnt.set(c, (cnt.get(c) ?? 0) + 1)
    }
  }

  return (custs ?? [])
    .map(c => ({ id: c.id, name: c.name, revenue: Math.round(rev.get(c.id) ?? 0), orderCount: cnt.get(c.id) ?? 0 }))
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}
