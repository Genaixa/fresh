import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { notFound } from 'next/navigation'
import { CONFIG } from '@/app/market/config'
import OrderClient from './OrderClient'

export const dynamic = 'force-dynamic'

export type OrderProduct = {
  id:               string
  name:             string
  category:         'veg' | 'fruit'
  retailPrice:      number
  caseSize:         number
  unitLabel:        string
  typicalBoxCount:  number
  // customer history
  orderCount:       number
  avgQty:           number
  avgUnitType:      'box' | 'retail_unit'
  lastSellPricePence: number | null  // last price charged to this customer
  // cost data
  lastBuyCostPence: number | null    // cheapest last supplier price (per box)
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

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, retail_price, case_size')
    .in('category', ['fruit', 'veg'])
    .eq('is_active', true)
    .order('name')

  // Order history for this customer (all time — drives favourites sort)
  const { data: pastOrders } = await supabase
    .from('wholesale_orders')
    .select('id, order_date')
    .eq('customer_id', customerId)
    .in('status', ['confirmed', 'dispatched'])
    .order('order_date', { ascending: false })

  const pastOrderIds = (pastOrders ?? []).map(o => o.id)

  // Per-product history: count, avg qty, and last sell price
  type HistEntry = { count: number; totalQty: number; unitType: 'box' | 'retail_unit'; lastSellPrice: number | null }
  const historyMap = new Map<string, HistEntry>()
  const latestOrderIdByProduct = new Map<string, string>() // product_id → most recent order id

  if (pastOrderIds.length > 0) {
    const { data: histItems } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_type, unit_price, order_id')
      .in('order_id', pastOrderIds)

    // pastOrders is already sorted newest first — build latest-order-id lookup
    for (const o of pastOrders ?? []) {
      // We'll fill this per product below
    }

    for (const item of histItems ?? []) {
      const ex = historyMap.get(item.product_id) ?? { count: 0, totalQty: 0, unitType: item.unit_type ?? 'retail_unit', lastSellPrice: null }
      ex.count    += 1
      ex.totalQty += Number(item.quantity)
      // Keep sell price from the most recent order (pastOrders sorted desc)
      if (!latestOrderIdByProduct.has(item.product_id)) {
        // First time we see this product — find which order it came from
        const orderIdx = pastOrderIds.indexOf(item.order_id)
        const existing = latestOrderIdByProduct.get(item.product_id)
        if (!existing || pastOrderIds.indexOf(item.order_id) < pastOrderIds.indexOf(existing)) {
          latestOrderIdByProduct.set(item.product_id, item.order_id)
          ex.lastSellPrice = item.unit_price
        }
      }
      historyMap.set(item.product_id, ex)
    }
  }

  // Last buy costs — cheapest last supplier price per product
  const { data: lastPrices } = await supabase
    .from('product_supplier_last_price')
    .select('product_id, last_price_p')

  const buyCostMap = new Map<string, number>()
  for (const row of lastPrices ?? []) {
    const existing = buyCostMap.get(row.product_id)
    if (!existing || row.last_price_p < existing) {
      buyCostMap.set(row.product_id, row.last_price_p)
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

  const draftItems = new Map<string, { qty: number; unitType: 'box' | 'retail_unit'; pricePence: number }>()
  if (draftOrder) {
    const { data: di } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_type, unit_price')
      .eq('order_id', draftOrder.id)
    for (const item of di ?? []) {
      draftItems.set(item.product_id, {
        qty:        Number(item.quantity),
        unitType:   (item.unit_type ?? 'retail_unit') as 'box' | 'retail_unit',
        pricePence: item.unit_price,
      })
    }
  }

  const orderProducts: OrderProduct[] = (products ?? [])
    .map(p => {
      const cfg  = CONFIG[p.name]
      const hist = historyMap.get(p.id)
      return {
        id:                 p.id,
        name:               p.name,
        category:           p.category as 'veg' | 'fruit',
        retailPrice:        p.retail_price,
        caseSize:           p.case_size ?? 1,
        unitLabel:          cfg?.unitLabel ?? 'unit',
        typicalBoxCount:    cfg?.typicalBoxCount ?? (p.case_size ?? 1),
        orderCount:         hist?.count ?? 0,
        avgQty:             hist ? Math.round(hist.totalQty / hist.count) : 0,
        avgUnitType:        hist?.unitType ?? (customer.is_internal ? 'box' : 'retail_unit'),
        lastSellPricePence: hist?.lastSellPrice ?? null,
        lastBuyCostPence:   buyCostMap.get(p.id) ?? null,
      }
    })

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

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <OrderClient
        customer={orderCustomer}
        products={orderProducts}
        defaultDeliveryDate={draftOrder?.delivery_date ?? todayStr}
        draftItems={Object.fromEntries(draftItems)}
        draftOrderId={draftOrder?.id ?? null}
      />
      <NavBar />
    </div>
  )
}
