import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { notFound } from 'next/navigation'
import { CONFIG } from '@/app/market/config'
import OrderClient from './OrderClient'

export const dynamic = 'force-dynamic'

export type OrderProduct = {
  id:            string
  name:          string
  category:      'veg' | 'fruit'
  retailPrice:   number   // pence
  caseSize:      number
  unitLabel:     string
  typicalBoxCount: number
  // history for this customer
  orderCount:    number   // how many past orders included this product
  avgQty:        number   // average qty ordered (in whatever unit they use)
  avgUnitType:   'box' | 'retail_unit'
}

export type OrderCustomer = {
  id:         string
  name:       string
  isInternal: boolean
}

export default async function OrderPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id, name, is_internal')
    .eq('id', customerId)
    .single()

  if (!customer) notFound()

  // Products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, retail_price, case_size')
    .in('category', ['fruit', 'veg'])
    .eq('is_active', true)
    .order('name')

  // Order history for this customer (last 12 weeks)
  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0]
  const { data: pastOrders } = await supabase
    .from('wholesale_orders')
    .select('id')
    .eq('customer_id', customerId)
    .gte('order_date', twelveWeeksAgo)
    .in('status', ['confirmed', 'delivered'])

  const pastOrderIds = (pastOrders ?? []).map(o => o.id)

  const historyMap = new Map<string, { count: number; totalQty: number; unitType: 'box' | 'retail_unit' }>()

  if (pastOrderIds.length > 0) {
    const { data: histItems } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_type')
      .in('order_id', pastOrderIds)

    for (const item of histItems ?? []) {
      const ex = historyMap.get(item.product_id) ?? { count: 0, totalQty: 0, unitType: item.unit_type ?? 'retail_unit' }
      ex.count    += 1
      ex.totalQty += Number(item.quantity)
      historyMap.set(item.product_id, ex)
    }
  }

  // Today's draft order if it exists
  const today = new Date().toISOString().split('T')[0]
  const { data: draftOrder } = await supabase
    .from('wholesale_orders')
    .select('id, delivery_date')
    .eq('customer_id', customerId)
    .eq('status', 'draft')
    .eq('order_date', today)
    .single()

  const draftItems = new Map<string, { qty: number; unitType: 'box' | 'retail_unit' }>()
  if (draftOrder) {
    const { data: di } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_type')
      .eq('order_id', draftOrder.id)
    for (const item of di ?? []) {
      draftItems.set(item.product_id, {
        qty:      Number(item.quantity),
        unitType: (item.unit_type ?? 'retail_unit') as 'box' | 'retail_unit',
      })
    }
  }

  const orderProducts: OrderProduct[] = (products ?? [])
    .filter(p => CONFIG[p.name])
    .map(p => {
      const cfg  = CONFIG[p.name]!
      const hist = historyMap.get(p.id)
      return {
        id:              p.id,
        name:            p.name,
        category:        p.category as 'veg' | 'fruit',
        retailPrice:     p.retail_price,
        caseSize:        p.case_size ?? 1,
        unitLabel:       cfg.unitLabel,
        typicalBoxCount: cfg.typicalBoxCount,
        orderCount:      hist?.count ?? 0,
        avgQty:          hist ? Math.round(hist.totalQty / hist.count) : 0,
        avgUnitType:     hist?.unitType ?? (customer.is_internal ? 'box' : 'retail_unit'),
      }
    })

  // Sort: favourites (ordered before) first, then alphabetical
  orderProducts.sort((a, b) => {
    if (a.orderCount > 0 && b.orderCount === 0) return -1
    if (a.orderCount === 0 && b.orderCount > 0) return 1
    if (a.orderCount !== b.orderCount) return b.orderCount - a.orderCount
    return a.name.localeCompare(b.name)
  })

  const orderCustomer: OrderCustomer = {
    id:         customer.id,
    name:       customer.name,
    isInternal: customer.is_internal ?? false,
  }

  // Tomorrow as default delivery date
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <OrderClient
        customer={orderCustomer}
        products={orderProducts}
        defaultDeliveryDate={draftOrder?.delivery_date ?? tomorrow}
        draftItems={Object.fromEntries(draftItems)}
        draftOrderId={draftOrder?.id ?? null}
      />
      <NavBar />
    </div>
  )
}
