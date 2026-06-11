import { createClient } from '@/lib/supabase/server'
import { CONFIG } from '@/app/market/config'
import { generateCfoBriefing } from './cfoGolem'
import CfoClient from './CfoClient'

export const dynamic = 'force-dynamic'

// Units per box for margin calculation — mirrors MarketBuyClient calcPricing logic
function unitsPerBox(name: string, caseSize: number): number | null {
  if (caseSize > 1) return caseSize
  const cfg = CONFIG[name]
  if (!cfg) return null
  if (cfg.unitType === 'count') return cfg.typicalBoxCount
  if (cfg.retailUnitsPerBox)    return cfg.retailUnitsPerBox
  return null
}

export type CfoProduct = {
  name:          string
  spend:         number        // pence total
  boxes:         number
  avgCostPerBox: number        // pence
  revPerBox:     number | null // pence (null = weight item, unknown units)
  margin:        number | null // 0–1
  retailPerUnit: number        // pence
  costPerUnit:   number        // pence
  isLossLeader:  boolean       // deliberately sold at/below cost — skip leak alerts
}

export type CfoCustomer = {
  id:         string
  name:       string
  revenue:    number
  orderCount: number
}

export type ReportAlert = {
  name:            string
  margin:          number
  purchase_cost:   number
  retail_price:    number
  suggested_price: number
}

export type ReportWinner = {
  name:         string
  margin:       number
  retail_price: number
}

export type Outstanding = {
  id:      string
  name:    string
  balance: number
  overdue: number
}

export type CfoData = {
  weekLabel:      string
  thisWeekSpend:  number
  lastWeekSpend:  number
  thisWeekRev:    number
  lastWeekRev:    number
  thisWeekMargin: number
  lastWeekMargin: number
  products:       CfoProduct[]
  lastProducts:   CfoProduct[]
  briefing:       string | null
  customers:      CfoCustomer[]
  reportAlerts:   ReportAlert[]
  reportWinners:  ReportWinner[]
  outstanding:    Outstanding[]
}

export default async function CfoPage() {
  const supabase = await createClient()

  // Week boundaries — Mon → today
  const today = new Date()
  const dow   = today.getDay()
  const daysSinceMon = dow === 0 ? 6 : dow - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMon)

  const thisStart = thisMonday.toISOString().split('T')[0]
  const lastStart = new Date(thisMonday.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const todayStr  = today.toISOString().split('T')[0]

  const weekLabel = `${thisMonday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  // 1. Fetch invoices for both weeks
  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_date')
    .gte('invoice_date', lastStart)
    .lte('invoice_date', todayStr)

  const thisWeekIds = new Set((invoices ?? []).filter(i => i.invoice_date >= thisStart).map(i => i.id))
  const lastWeekIds = new Set((invoices ?? []).filter(i => i.invoice_date < thisStart).map(i => i.id))

  // 2. Fetch all items + products for those invoices
  const allIds = [...thisWeekIds, ...lastWeekIds]
  const { data: items } = allIds.length
    ? await supabase
        .from('purchase_invoice_items')
        .select('invoice_id, product_id, unit_cost, quantity, total_cost')
        .in('invoice_id', allIds)
    : { data: [] }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, retail_price, case_size, purchase_cost, margin_floor, is_loss_leader')
    .eq('is_active', true)

  const prodMap = new Map((products ?? []).map(p => [p.id, p]))

  // 3. Aggregate items by week
  function aggregate(ids: Set<string>): CfoProduct[] {
    const byProd = new Map<string, { spend: number; boxes: number; name: string; retail: number; caseSize: number; lossLeader: boolean }>()

    for (const item of items ?? []) {
      if (!ids.has(item.invoice_id)) continue
      const p = prodMap.get(item.product_id)
      if (!p || !p.retail_price) continue

      const existing = byProd.get(item.product_id) ?? {
        spend: 0, boxes: 0,
        name: p.name, retail: p.retail_price, caseSize: p.case_size ?? 1,
        lossLeader: p.is_loss_leader ?? false,
      }
      existing.spend += item.total_cost ?? Math.round(item.unit_cost * Number(item.quantity))
      existing.boxes += Number(item.quantity)
      byProd.set(item.product_id, existing)
    }

    return [...byProd.values()].map(r => {
      const avgCostPerBox = r.boxes > 0 ? Math.round(r.spend / r.boxes) : 0
      const upb           = unitsPerBox(r.name, r.caseSize)
      const revPerBox     = upb ? r.retail * upb : null
      const costPerUnit   = upb ? Math.round(avgCostPerBox / upb) : avgCostPerBox
      const margin        = revPerBox ? (revPerBox - avgCostPerBox) / revPerBox : null

      return { name: r.name, spend: r.spend, boxes: r.boxes, avgCostPerBox, revPerBox, margin, retailPerUnit: r.retail, costPerUnit, isLossLeader: r.lossLeader }
    }).sort((a, b) => b.spend - a.spend)
  }

  const thisProducts = aggregate(thisWeekIds)
  const lastProducts = aggregate(lastWeekIds)

  // 4. Totals
  const thisWeekSpend = thisProducts.reduce((s, p) => s + p.spend, 0)
  const lastWeekSpend = lastProducts.reduce((s, p) => s + p.spend, 0)

  const knownThis = thisProducts.filter(p => p.revPerBox !== null)
  const knownLast = lastProducts.filter(p => p.revPerBox !== null)

  const thisWeekRev    = knownThis.reduce((s, p) => s + p.revPerBox! * p.boxes, 0)
  const lastWeekRev    = knownLast.reduce((s, p) => s + p.revPerBox! * p.boxes, 0)
  const thisKnownSpend = knownThis.reduce((s, p) => s + p.spend, 0)
  const lastKnownSpend = knownLast.reduce((s, p) => s + p.spend, 0)
  const thisWeekMargin = thisWeekRev > 0 ? (thisWeekRev - thisKnownSpend) / thisWeekRev : 0
  const lastWeekMargin = lastWeekRev > 0 ? (lastWeekRev - lastKnownSpend) / lastWeekRev : 0

  // 5. AI briefing
  const losingMoney = thisProducts.filter(p => p.margin !== null && p.margin < 0 && !p.isLossLeader)
  const briefing = await generateCfoBriefing({
    weekLabel,
    thisWeekSpend,
    lastWeekSpend,
    thisWeekMargin,
    lastWeekMargin,
    losingMoney: losingMoney.map(p => ({
      name:          p.name,
      margin:        p.margin!,
      costPerUnit:   p.costPerUnit,
      retailPerUnit: p.retailPerUnit,
    })),
    topSpends: thisProducts.slice(0, 8).map(p => ({
      name:   p.name,
      spend:  p.spend,
      boxes:  p.boxes,
      margin: p.margin ?? 0,
    })),
    priceAlerts: thisProducts
      .filter(p => p.margin !== null && p.margin < 0.10 && p.margin >= 0)
      .map(p => ({
        name:         p.name,
        paidPerBox:   p.avgCostPerBox,
        lastSetPerBox: p.revPerBox ?? 0,
        changePct:    p.margin !== null ? (0.40 - p.margin) * 100 : 0,
      })),
  })

  // 6. Wholesale customer summary (last 12 weeks)
  const twelveWeeksAgo = new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0]
  const { data: wsOrders } = await supabase
    .from('wholesale_orders')
    .select('id, customer_id')
    .gte('order_date', twelveWeeksAgo)
    .in('status', ['confirmed', 'dispatched'])

  const { data: wsCustomers } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('is_active', true)
    .eq('is_internal', false)

  const wsOrderIds = (wsOrders ?? []).map(o => o.id)
  let wsRevByCustomer = new Map<string, number>()
  let wsOrderCountByCustomer = new Map<string, number>()

  if (wsOrderIds.length > 0) {
    const { data: wsItems } = await supabase
      .from('wholesale_order_items')
      .select('order_id, quantity, unit_price')
      .in('order_id', wsOrderIds)

    const orderCustomerMap = new Map((wsOrders ?? []).map(o => [o.id, o.customer_id]))
    for (const item of wsItems ?? []) {
      const custId = orderCustomerMap.get(item.order_id)
      if (!custId) continue
      wsRevByCustomer.set(custId, (wsRevByCustomer.get(custId) ?? 0) + Number(item.quantity) * item.unit_price)
      wsOrderCountByCustomer.set(custId, (wsOrderCountByCustomer.get(custId) ?? 0) + 1)
    }
  }

  const customers: CfoCustomer[] = (wsCustomers ?? [])
    .map(c => ({
      id:         c.id,
      name:       c.name,
      revenue:    Math.round(wsRevByCustomer.get(c.id) ?? 0),
      orderCount: wsOrderCountByCustomer.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // 7. Report tab — alerts and winners from confirmed product costs
  function roundToNearestFivePence(pence: number): number {
    return Math.ceil(pence / 5) * 5
  }

  const reportAlerts: ReportAlert[] = (products ?? [])
    .filter(p => p.purchase_cost > 0 && p.retail_price > 0 && !p.is_loss_leader)
    .map(p => {
      const floor  = p.margin_floor ?? 0.20
      const margin = (p.retail_price - p.purchase_cost) / p.retail_price
      return {
        name:            p.name,
        margin,
        purchase_cost:   p.purchase_cost,
        retail_price:    p.retail_price,
        suggested_price: roundToNearestFivePence(Math.ceil(p.purchase_cost / (1 - floor))),
        _floor:          floor,
      }
    })
    .filter(p => p.margin < p._floor)
    .map(({ _floor: _, ...rest }) => rest)
    .sort((a, b) => a.margin - b.margin)

  const reportWinners: ReportWinner[] = (products ?? [])
    .filter(p => p.purchase_cost > 0 && p.retail_price > 0)
    .map(p => ({
      name:         p.name,
      margin:       (p.retail_price - p.purchase_cost) / p.retail_price,
      retail_price: p.retail_price,
    }))
    .filter(p => p.margin >= 0.40 && p.margin <= 0.90)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5)

  // 8. AR snapshot — outstanding balances (top 5 owed)
  await supabase.rpc('mark_overdue_invoices')
  const { data: invSums } = await supabase
    .from('wholesale_invoices')
    .select('customer_id, total_amount, amount_paid, payment_status')

  const custNameMap = new Map((wsCustomers ?? []).map(c => [c.id, c.name]))
  const balByCust = new Map<string, { balance: number; overdue: number }>()
  for (const inv of invSums ?? []) {
    const bal = inv.total_amount - inv.amount_paid
    const cur = balByCust.get(inv.customer_id) ?? { balance: 0, overdue: 0 }
    cur.balance += bal
    if (inv.payment_status === 'overdue') cur.overdue += bal
    balByCust.set(inv.customer_id, cur)
  }
  // Only real external debtors — custNameMap holds active, non-internal customers,
  // so this drops the internal shop ("Fresh & Fruity") and anyone inactive.
  const outstanding: Outstanding[] = [...balByCust.entries()]
    .filter(([id]) => custNameMap.has(id))
    .map(([id, v]) => ({ id, name: custNameMap.get(id)!, balance: v.balance, overdue: v.overdue }))
    .filter(o => o.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)

  const cfoData: CfoData = {
    weekLabel,
    thisWeekSpend,
    lastWeekSpend,
    thisWeekRev,
    lastWeekRev,
    thisWeekMargin,
    lastWeekMargin,
    products:  thisProducts,
    lastProducts,
    briefing,
    customers,
    reportAlerts,
    reportWinners,
    outstanding,
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <CfoClient data={cfoData} />
    </div>
  )
}
