import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
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
    .select('id, name, retail_price, case_size')
    .eq('is_active', true)

  const prodMap = new Map((products ?? []).map(p => [p.id, p]))

  // 3. Aggregate items by week
  function aggregate(ids: Set<string>): CfoProduct[] {
    const byProd = new Map<string, { spend: number; boxes: number; name: string; retail: number; caseSize: number }>()

    for (const item of items ?? []) {
      if (!ids.has(item.invoice_id)) continue
      const p = prodMap.get(item.product_id)
      if (!p || !p.retail_price) continue

      const existing = byProd.get(item.product_id) ?? {
        spend: 0, boxes: 0,
        name: p.name, retail: p.retail_price, caseSize: p.case_size ?? 1,
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

      return { name: r.name, spend: r.spend, boxes: r.boxes, avgCostPerBox, revPerBox, margin, retailPerUnit: r.retail, costPerUnit }
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
  const losingMoney = thisProducts.filter(p => p.margin !== null && p.margin < 0)
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
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <CfoClient data={cfoData} />
      <NavBar />
    </div>
  )
}
