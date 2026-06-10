import { createClient } from '@/lib/supabase/server'
import MarketBuyClient from '@/app/market/MarketBuyClient'
import { CONFIG } from '@/app/market/config'
import { generateMarketInsights } from '@/app/market/marketGolem'
import type { MarketProduct, MarketSession, MarketSessionItem, SupplierIds } from '@/app/market/page'

export const dynamic = 'force-dynamic'

const SUPPLIER_IDS: SupplierIds = {
  dole:    '11111111-0000-0000-0000-000000000002',
  holland: '11111111-0000-0000-0000-000000000001',
} as const

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function MarketRunPage() {
  const supabase = await createClient()
  const today        = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().getMonth() + 1

  // ── Session (type='run' — separate from market-buy sessions) ─────────────
  const { data: sessions } = await supabase
    .from('market_sessions')
    .select('id, session_date, status, roots_batches, veg_batches, fruit_batches, trip_number')
    .eq('session_date', today)
    .eq('session_type', 'run')
    .order('opened_at', { ascending: false })
    .limit(1)

  let session = sessions?.[0] ?? null

  if (!session) {
    const { data } = await supabase
      .from('market_sessions')
      .insert({ session_date: today, status: 'open', session_type: 'run' })
      .select('id, session_date, status, roots_batches, veg_batches, fruit_batches, trip_number')
      .single()
    session = data
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, retail_price, price_multiplier, margin_floor, case_size')
    .in('category', ['fruit', 'veg'])
    .eq('is_active', true)
    .order('name')

  // ── hasDole / hasHolland ──────────────────────────────────────────────────
  const { data: mappings } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, supplier_name')
    .eq('status', 'confirmed')

  const doleSet    = new Set<string>()
  const hollandSet = new Set<string>()
  for (const m of mappings ?? []) {
    const sn = m.supplier_name.toLowerCase()
    if (sn === 'dole wholesale gateshead' || sn === 'total produce') doleSet.add(m.product_id)
    if (sn === 'jr holland') hollandSet.add(m.product_id)
  }

  // ── Last price per supplier ───────────────────────────────────────────────
  const { data: lastPrices } = await supabase
    .from('product_supplier_last_price')
    .select('product_id, supplier_name, last_price_p, last_date')

  const { data: mappingPrices } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, supplier_name, last_price_p, appearances')
    .eq('status', 'confirmed')
    .not('last_price_p', 'is', null)
    .order('appearances', { ascending: false })

  const doleFallback    = new Map<string, number>()
  const hollandFallback = new Map<string, number>()
  for (const m of mappingPrices ?? []) {
    const sn = m.supplier_name.toLowerCase()
    if ((sn === 'dole wholesale gateshead' || sn === 'total produce') && !doleFallback.has(m.product_id))
      doleFallback.set(m.product_id, m.last_price_p)
    if (sn === 'jr holland' && !hollandFallback.has(m.product_id))
      hollandFallback.set(m.product_id, m.last_price_p)
  }

  const dolePriceMap    = new Map<string, { p: number; d: string | null }>()
  const hollandPriceMap = new Map<string, { p: number; d: string | null }>()
  for (const row of lastPrices ?? []) {
    const sn = row.supplier_name.toLowerCase()
    if (sn === 'dole wholesale gateshead' || sn === 'total produce')
      dolePriceMap.set(row.product_id, { p: row.last_price_p, d: row.last_date })
    if (sn === 'jr holland')
      hollandPriceMap.set(row.product_id, { p: row.last_price_p, d: row.last_date })
  }
  for (const [pid, price] of doleFallback)
    if (!dolePriceMap.has(pid)) dolePriceMap.set(pid, { p: price, d: null })
  for (const [pid, price] of hollandFallback)
    if (!hollandPriceMap.has(pid)) hollandPriceMap.set(pid, { p: price, d: null })

  // ── Seasonal averages ─────────────────────────────────────────────────────
  const { data: seasonalAvgs } = await supabase
    .from('product_seasonal_averages')
    .select('product_id, unit_type, avg_price_per_unit_pence')
    .eq('month_number', currentMonth)

  const seasonalMap = new Map<string, { weight: number | null; count: number | null }>()
  for (const row of seasonalAvgs ?? []) {
    const e = seasonalMap.get(row.product_id) ?? { weight: null, count: null }
    if (row.unit_type === 'weight') e.weight = row.avg_price_per_unit_pence
    if (row.unit_type === 'count')  e.count  = row.avg_price_per_unit_pence
    seasonalMap.set(row.product_id, e)
  }

  // ── Wholesale orders due today or tomorrow ────────────────────────────────
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  const { data: pendingOrders } = await supabase
    .from('wholesale_orders')
    .select('id')
    .in('status', ['confirmed', 'draft'])
    .or(`delivery_date.eq.${today},delivery_date.eq.${tomorrow},delivery_date.is.null`)

  const wholesaleQtyMap       = new Map<string, number>()
  const wholesaleBreakdownMap = new Map<string, { customerName: string; qty: number }[]>()
  if (pendingOrders && pendingOrders.length > 0) {
    const { data: orderItems } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, order:wholesale_orders(customer:wholesale_customers(name))')
      .in('order_id', pendingOrders.map(o => o.id))
    for (const item of orderItems ?? []) {
      const qty = Number(item.quantity)
      wholesaleQtyMap.set(item.product_id, (wholesaleQtyMap.get(item.product_id) ?? 0) + qty)
      const customerName = (item.order as any)?.customer?.name ?? 'Unknown'
      const existing = wholesaleBreakdownMap.get(item.product_id) ?? []
      const entry = existing.find(e => e.customerName === customerName)
      if (entry) entry.qty += qty
      else existing.push({ customerName, qty })
      wholesaleBreakdownMap.set(item.product_id, existing)
    }
  }

  // ── Existing session items ────────────────────────────────────────────────
  const { data: existingItems } = session
    ? await supabase
        .from('market_session_items')
        .select('id, product_id, entry_index, supplier_id, qty_boxes, price_pence, deal_status, units_per_case')
        .eq('session_id', session.id)
    : { data: [] }

  // ── Merge ─────────────────────────────────────────────────────────────────
  const marketProducts: MarketProduct[] = (products ?? [])
    .filter(p => CONFIG[p.name] !== undefined)
    .map(p => {
      const cfg   = CONFIG[p.name]!
      const avgs  = seasonalMap.get(p.id) ?? { weight: null, count: null }
      const avgPU = cfg.unitType === 'weight' ? avgs.weight : avgs.count
      const dole  = dolePriceMap.get(p.id)    ?? null
      const holl  = hollandPriceMap.get(p.id) ?? null

      const wsRetailQty = wholesaleQtyMap.get(p.id) ?? 0
      const unitsPerBox = p.case_size > 1 ? p.case_size
                        : cfg.unitType === 'count' ? cfg.typicalBoxCount
                        : cfg.retailUnitsPerBox ?? cfg.typicalBoxCount
      const wsBoxes = wsRetailQty > 0 ? Math.ceil(wsRetailQty / unitsPerBox) : 0

      return {
        id:                     p.id,
        name:                   p.name,
        category:               p.category as 'fruit' | 'veg',
        hasDole:                doleSet.has(p.id),
        hasHolland:             hollandSet.has(p.id),
        doleLastPricePence:     dole?.p ?? null,
        doleLastDate:           fmtDate(dole?.d ?? null),
        hollandLastPricePence:  holl?.p ?? null,
        hollandLastDate:        fmtDate(holl?.d ?? null),
        junAvgBoxPricePence:    avgPU ? Math.round(avgPU * cfg.typicalBoxCount) : null,
        maxBoxPricePence:       Math.round(cfg.maxPayPerUnitPence * cfg.typicalBoxCount),
        retailPricePence:       p.retail_price ?? 0,
        priceMultiplier:        Number(p.price_multiplier ?? 2),
        marginFloor:            Number(p.margin_floor ?? 0.20),
        caseSize:               p.case_size ?? 1,
        wholesaleQtyBoxes:      wsBoxes,
        wholesaleBreakdown:     wholesaleBreakdownMap.get(p.id) ?? [],
      }
    })

  // requiredProductIds = products that have pending orders — shown by default
  const requiredProductIds = marketProducts
    .filter(p => p.wholesaleQtyBoxes > 0)
    .map(p => p.id)

  // ── Market Golem ──────────────────────────────────────────────────────────
  const golem = await generateMarketInsights(marketProducts)

  const productsWithTips: MarketProduct[] = marketProducts.map(p => ({
    ...p,
    tip: golem.tips[p.name] ?? undefined,
  }))

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-52 bg-white min-h-screen">
      <MarketBuyClient
        session={session as MarketSession}
        products={productsWithTips}
        existingItems={(existingItems ?? []) as MarketSessionItem[]}
        supplierIds={SUPPLIER_IDS}
        briefing={golem.briefing}
        runMode={true}
        requiredProductIds={requiredProductIds}
      />
    </div>
  )
}
