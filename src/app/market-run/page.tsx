import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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
    .select('id, name, category, retail_price, price_multiplier, margin_floor, case_size, market_section')
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

  // ── LIVE per-unit benchmark + per-supplier per-unit price (from invoices) ──────
  // Replaces the frozen seasonal avg / config box-max for the deal judgment: a live
  // 4-wk per-unit average, and each supplier's actual last per-unit price (box-size
  // correct), so a 12kg apple box is no longer judged against a 4kg-box budget.
  // Previous box price per supplier (the buy before last) — the whole deal engine.
  const { data: priceMoves } = await supabase
    .from('product_supplier_price_moves')
    .select('product_id, supplier_key, prev_p, prev_date')
  const dolePrevMap    = new Map<string, { p: number; d: string | null }>()
  const hollandPrevMap = new Map<string, { p: number; d: string | null }>()
  for (const row of priceMoves ?? []) {
    if (row.prev_p == null) continue
    if (row.supplier_key === 'dole')    dolePrevMap.set(row.product_id, { p: row.prev_p, d: row.prev_date })
    if (row.supplier_key === 'holland') hollandPrevMap.set(row.product_id, { p: row.prev_p, d: row.prev_date })
  }

  // ── Wholesale orders due today or tomorrow ────────────────────────────────
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  const { data: pendingOrders } = await supabase
    .from('wholesale_orders')
    .select('id')
    .in('status', ['confirmed', 'draft'])
    .or(`delivery_date.eq.${today},delivery_date.eq.${tomorrow},delivery_date.is.null`)

  // Track box-orders and loose (retail_unit) orders SEPARATELY — a box qty must
  // NOT be divided by units-per-box again (customers order mostly in whole boxes).
  const wholesaleQtyMap       = new Map<string, { boxes: number; units: number }>()
  const wholesaleBreakdownMap = new Map<string, { customerName: string; boxes: number; units: number }[]>()
  if (pendingOrders && pendingOrders.length > 0) {
    const { data: orderItems } = await supabase
      .from('wholesale_order_items')
      .select('product_id, quantity, unit_type, order:wholesale_orders(customer:wholesale_customers(name))')
      .in('order_id', pendingOrders.map(o => o.id))
    for (const item of orderItems ?? []) {
      const qty = Number(item.quantity)
      const isBox = item.unit_type === 'box'
      const agg = wholesaleQtyMap.get(item.product_id) ?? { boxes: 0, units: 0 }
      if (isBox) agg.boxes += qty; else agg.units += qty
      wholesaleQtyMap.set(item.product_id, agg)
      const customerName = (item.order as any)?.customer?.name ?? 'Unknown'
      const existing = wholesaleBreakdownMap.get(item.product_id) ?? []
      const entry = existing.find(e => e.customerName === customerName)
      if (entry) { if (isBox) entry.boxes += qty; else entry.units += qty }
      else existing.push({ customerName, boxes: isBox ? qty : 0, units: isBox ? 0 : qty })
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

      // Box orders count directly; loose (retail_unit) orders convert to boxes.
      const ws          = wholesaleQtyMap.get(p.id) ?? { boxes: 0, units: 0 }
      const unitsPerBox = p.case_size > 1 ? p.case_size
                        : cfg.unitType === 'count' ? cfg.typicalBoxCount
                        : cfg.retailUnitsPerBox ?? cfg.typicalBoxCount
      const wsBoxes = ws.boxes + (ws.units > 0 ? Math.ceil(ws.units / unitsPerBox) : 0)

      return {
        id:                     p.id,
        name:                   p.name,
        category:               p.category as 'fruit' | 'veg',
        marketSection:          (p.market_section as string) ?? p.category,
        hasDole:                doleSet.has(p.id),
        hasHolland:             hollandSet.has(p.id),
        doleLastPricePence:     dole?.p ?? null,
        doleLastDate:           fmtDate(dole?.d ?? null),
        doleLastDateISO:        dole?.d ?? null,
        dolePrevPricePence:     dolePrevMap.get(p.id)?.p ?? null,
        dolePrevDate:           dolePrevMap.get(p.id)?.d ?? null,
        hollandLastPricePence:  holl?.p ?? null,
        hollandLastDate:        fmtDate(holl?.d ?? null),
        hollandLastDateISO:     holl?.d ?? null,
        hollandPrevPricePence:  hollandPrevMap.get(p.id)?.p ?? null,
        hollandPrevDate:        hollandPrevMap.get(p.id)?.d ?? null,
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

  // ── Market Golem — served from cache so the page never blocks on the LLM.
  // First visit of the day kicks generation off in the background (after the
  // response is sent); every later load gets the briefing instantly.
  const cacheKey = `market-run:${today}`
  const { data: cachedBriefing } = await supabase
    .from('ai_briefings')
    .select('briefing, tips')
    .eq('key', cacheKey)
    .maybeSingle()

  let golem: { briefing: string | null; tips: Record<string, string> }
  if (cachedBriefing) {
    golem = {
      briefing: cachedBriefing.briefing,
      tips:     (cachedBriefing.tips ?? {}) as Record<string, string>,
    }
  } else {
    golem = { briefing: null, tips: {} }
    after(async () => {
      try {
        const fresh = await generateMarketInsights(marketProducts)
        if (fresh.briefing || Object.keys(fresh.tips).length > 0) {
          await createServiceClient()
            .from('ai_briefings')
            .upsert({ key: cacheKey, briefing: fresh.briefing, tips: fresh.tips })
        }
      } catch { /* tips are optional sugar — never break the page for them */ }
    })
  }

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
