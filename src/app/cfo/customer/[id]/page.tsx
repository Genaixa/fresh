import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { notFound } from 'next/navigation'
import { CONFIG } from '@/app/market/config'
import CustomerCfoClient from './CustomerCfoClient'

export const dynamic = 'force-dynamic'

export type CustomerProduct = {
  name:          string
  totalRevenue:  number   // pence — what customer paid
  totalQty:      number   // boxes equivalent
  avgSellPerBox: number   // pence
  avgBuyPerBox:  number | null  // pence — what David paid (null = no invoice data)
  margin:        number | null  // 0–1
  profitPence:   number | null
  unitType:      'box' | 'retail_unit'
  typicalBoxCount: number
  orderCount:    number   // how many orders this appeared in
  hasCostData:   boolean
}

export type CustomerSummary = {
  id:            string
  name:          string
  totalRevenue:  number
  totalCost:     number   // only products with cost data
  totalProfit:   number
  margin:        number | null
  coveredRevenue: number  // revenue on products where we have cost data
  uncoveredRevenue: number
  products:      CustomerProduct[]
  periodLabel:   string
}

export default async function CustomerCfoPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ weeks?: string }>
}) {
  const { id }    = await params
  const { weeks } = await searchParams
  const weeksBack = parseInt(weeks ?? '12')

  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  const fromDate = new Date(Date.now() - weeksBack * 7 * 86400000).toISOString().split('T')[0]
  const periodLabel = weeksBack === 4  ? 'Last 4 weeks'
                    : weeksBack === 12 ? 'Last 3 months'
                    : weeksBack === 26 ? 'Last 6 months'
                    : 'Last 12 months'

  // 1. Customer revenue — what they paid per product
  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id')
    .eq('customer_id', id)
    .gte('order_date', fromDate)
    .in('status', ['confirmed', 'dispatched'])

  const orderIds = (orders ?? []).map(o => o.id)

  type RawItem = { product_id: string; quantity: number; unit_price: number; unit_type: string; order_id: string }
  let orderItems: RawItem[] = []

  if (orderIds.length > 0) {
    const { data } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_price, unit_type, order_id')
      .in('order_id', orderIds)
    orderItems = (data ?? []) as RawItem[]
  }

  // 2. David's buy cost — average per product over same period
  const { data: invoiceItems } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, quantity, invoice_id')
    .gt('unit_cost', 0)

  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('id')
    .gte('invoice_date', fromDate)

  const invoiceIds = new Set((invoices ?? []).map(i => i.id))
  const buyCostMap = new Map<string, { total: number; count: number }>()

  for (const item of invoiceItems ?? []) {
    if (!invoiceIds.has(item.invoice_id)) continue
    const ex = buyCostMap.get(item.product_id) ?? { total: 0, count: 0 }
    ex.total += item.unit_cost
    ex.count += 1
    buyCostMap.set(item.product_id, ex)
  }

  // Fallback: last known price from supplier last price view
  const { data: lastPrices } = await supabase
    .from('product_supplier_last_price')
    .select('product_id, last_price_p')

  const fallbackCostMap = new Map<string, number>()
  for (const row of lastPrices ?? []) {
    const ex = fallbackCostMap.get(row.product_id)
    if (!ex || row.last_price_p < ex) fallbackCostMap.set(row.product_id, row.last_price_p)
  }

  // 3. Product details
  const { data: products } = await supabase
    .from('products')
    .select('id, name, case_size')

  const prodMap = new Map((products ?? []).map(p => [p.id, p]))

  // 4. Aggregate by product
  type Agg = { revenue: number; boxes: number; orderSet: Set<string>; unitType: string }
  const byProduct = new Map<string, Agg>()

  for (const item of orderItems) {
    const ex = byProduct.get(item.product_id) ?? { revenue: 0, boxes: 0, orderSet: new Set(), unitType: item.unit_type ?? 'retail_unit' }
    const qty = Number(item.quantity)
    ex.revenue += qty * item.unit_price

    // Convert to box equivalent for comparison
    const prod = prodMap.get(item.product_id)
    const cfg  = prod ? CONFIG[prod.name] : null
    const unitsPerBox = prod && (prod.case_size ?? 1) > 1 ? (prod.case_size ?? 1)
                      : cfg?.unitType === 'count' ? cfg.typicalBoxCount
                      : cfg?.retailUnitsPerBox ?? cfg?.typicalBoxCount ?? 1
    ex.boxes += item.unit_type === 'box' ? qty : qty / unitsPerBox

    ex.orderSet.add(item.order_id)
    byProduct.set(item.product_id, ex)
  }

  const customerProducts: CustomerProduct[] = []

  for (const [productId, agg] of byProduct) {
    const prod = prodMap.get(productId)
    if (!prod) continue
    const cfg  = CONFIG[prod.name]

    const avgSellPerBox = agg.boxes > 0 ? Math.round(agg.revenue / agg.boxes) : 0

    // Buy cost: period average first, fallback to last known
    const buyCostEntry = buyCostMap.get(productId)
    const avgBuyPerBox = buyCostEntry
      ? Math.round(buyCostEntry.total / buyCostEntry.count)
      : fallbackCostMap.get(productId) ?? null

    const hasCostData = !!avgBuyPerBox
    const margin      = avgBuyPerBox && avgSellPerBox > 0
      ? (avgSellPerBox - avgBuyPerBox) / avgSellPerBox
      : null
    const profitPence = avgBuyPerBox
      ? Math.round((avgSellPerBox - avgBuyPerBox) * agg.boxes)
      : null

    customerProducts.push({
      name:            prod.name,
      totalRevenue:    Math.round(agg.revenue),
      totalQty:        Math.round(agg.boxes * 10) / 10,
      avgSellPerBox,
      avgBuyPerBox,
      margin,
      profitPence,
      unitType:        agg.unitType as 'box' | 'retail_unit',
      typicalBoxCount: cfg?.typicalBoxCount ?? 1,
      orderCount:      agg.orderSet.size,
      hasCostData,
    })
  }

  customerProducts.sort((a, b) => b.totalRevenue - a.totalRevenue)

  // 5. Totals
  const totalRevenue  = customerProducts.reduce((s, p) => s + p.totalRevenue, 0)
  const withCost      = customerProducts.filter(p => p.hasCostData)
  const coveredRev    = withCost.reduce((s, p) => s + p.totalRevenue, 0)
  const totalCost     = withCost.reduce((s, p) => s + (p.avgBuyPerBox! * p.totalQty), 0)
  const totalProfit   = withCost.reduce((s, p) => s + (p.profitPence ?? 0), 0)
  const margin        = coveredRev > 0 ? (coveredRev - totalCost) / coveredRev : null

  const summary: CustomerSummary = {
    id:              customer.id,
    name:            customer.name,
    totalRevenue,
    totalCost:       Math.round(totalCost),
    totalProfit,
    margin,
    coveredRevenue:  coveredRev,
    uncoveredRevenue: totalRevenue - coveredRev,
    products:        customerProducts,
    periodLabel,
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <CustomerCfoClient summary={summary} currentWeeks={weeksBack} />
      <NavBar />
    </div>
  )
}
