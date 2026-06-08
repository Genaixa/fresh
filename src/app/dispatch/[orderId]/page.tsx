import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DispatchDeliveryClient from './DispatchDeliveryClient'

export const dynamic = 'force-dynamic'

export default async function DispatchDeliveryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('wholesale_orders')
    .select(`
      id, status, delivery_date,
      customer:wholesale_customers(id, name),
      items:wholesale_order_items(
        id, product_id, quantity, unit_type, unit_price,
        product:products(id, name)
      )
    `)
    .eq('id', orderId)
    .single()

  if (!order) notFound()

  // All remaining confirmed orders to work out "next customer"
  const { data: allConfirmed } = await supabase
    .from('wholesale_orders')
    .select('id, customer:wholesale_customers(name)')
    .eq('status', 'confirmed')
    .order('delivery_date', { ascending: true, nullsFirst: false })

  const confirmList = (allConfirmed ?? []) as any[]
  const currentIdx = confirmList.findIndex(o => o.id === orderId)
  const nextOrder = currentIdx >= 0 ? (confirmList[currentIdx + 1] ?? null) : null

  return (
    <DispatchDeliveryClient
      order={order as any}
      nextOrderId={nextOrder?.id ?? null}
      nextCustomerName={(nextOrder?.customer as any)?.name ?? null}
    />
  )
}
