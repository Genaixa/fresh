import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ShopOrderBuilder from './ShopOrderBuilder'

export const dynamic = 'force-dynamic'

// David's own SHOP order — what the shop floor needs. It is recorded against the
// internal "Shop Floor" customer so it feeds /market-run's demand exactly like a
// wholesale order. Favourites + per-weekday quantities are seeded from EPOS
// sell-through (sales_data), keyed by weekday (Mon→Mon … the shop's weekly rhythm).
export default async function ShopOrderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/shop-order')

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id')
    .eq('name', 'Fresh & Fruity – Shop Floor')
    .single()
  if (!customer) {
    return (
      <div className="page text-center pt-20">
        <p className="text-[var(--text-muted)]">Shop Floor account missing — contact support.</p>
      </div>
    )
  }

  // Pull mapped produce sell-through and average it per weekday in JS. Use a
  // TRAILING WINDOW (last 8 weeks) so the list LEARNS: a newly-trending item
  // (e.g. blue oranges that start selling on Fridays) surfaces on that weekday
  // automatically, and lines that stop selling age out. Recompute on every load.
  const windowStart = new Date(Date.now() - 56 * 86_400_000).toISOString().split('T')[0]
  const { data: sales } = await supabase
    .from('sales_data')
    .select('quantity_sold, sale_date, product:products(id, name, category, unit, is_active)')
    .eq('source', 'epos_export')
    .not('product_id', 'is', null)
    .gte('sale_date', windowStart)

  // product_id -> { meta, byDow: {1..5: {sum,n}} }
  const acc = new Map<string, { name: string; category: string; unit: string; byDow: Record<number, { sum: number; n: number }> }>()
  for (const row of sales ?? []) {
    const p = row.product as any
    if (!p || !p.is_active || (p.category !== 'fruit' && p.category !== 'veg')) continue
    // JS getDay/ISO: use local date parts; Mon=1..Fri=5 via getUTCDay on the date string
    const dow = new Date(row.sale_date + 'T00:00:00').getDay() // 0=Sun..6=Sat
    if (dow < 1 || dow > 5) continue
    let rec = acc.get(p.id)
    if (!rec) { rec = { name: p.name, category: p.category, unit: p.unit, byDow: {} }; acc.set(p.id, rec) }
    const d = rec.byDow[dow] ?? { sum: 0, n: 0 }
    d.sum += Number(row.quantity_sold); d.n += 1
    rec.byDow[dow] = d
  }

  // Build product list with rounded per-weekday averages + a total for sort order.
  const products = [...acc.entries()].map(([id, r]) => {
    const avg: Record<number, number> = {}
    let total = 0
    for (let dow = 1; dow <= 5; dow++) {
      const d = r.byDow[dow]
      const a = d && d.n ? Math.round(d.sum / d.n) : 0
      avg[dow] = a
      total += a
    }
    return { id, name: r.name, category: r.category as 'fruit' | 'veg', unit: r.unit, avgByDow: avg, total }
  })
  .filter(p => p.total > 0)
  .sort((a, b) => b.total - a.total)

  // Full produce catalogue for the "add anything" search (e.g. a one-off
  // pre-order for an item the shop doesn't normally sell on that weekday).
  const { data: cat } = await supabase
    .from('products')
    .select('id, name, category, unit')
    .in('category', ['fruit', 'veg'])
    .eq('is_active', true)
    .order('name')
  const catalogue = (cat ?? []).map(c => ({
    id: c.id, name: c.name, category: c.category as 'fruit' | 'veg', unit: c.unit,
  }))

  // Box weight per product (kg ↔ boxes helper on the order rows). A product can be
  // bought in several box sizes across suppliers; take the MODAL weight-type box
  // (e.g. peppers = 5kg). Only weight-type mappings — count/each boxes don't convert.
  const { data: maps } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, box_weight_kg')
    .eq('unit_type', 'weight')
    .gt('box_weight_kg', 0)
  const wfreq = new Map<string, Map<number, number>>()
  for (const m of maps ?? []) {
    if (!m.product_id || !m.box_weight_kg) continue
    const w = Math.round(Number(m.box_weight_kg) * 100) / 100
    let inner = wfreq.get(m.product_id)
    if (!inner) { inner = new Map(); wfreq.set(m.product_id, inner) }
    inner.set(w, (inner.get(w) ?? 0) + 1)
  }
  const boxKg: Record<string, number> = {}
  for (const [pid, inner] of wfreq) {
    let bestW = 0, bestN = -1
    for (const [w, n] of inner) if (n > bestN || (n === bestN && w > bestW)) { bestN = n; bestW = w }
    if (bestW > 0) boxKg[pid] = bestW
  }

  // Per-box COUNT for 'each' items bought by the box (case_size > 1, e.g. cucumber
  // 16, celeriac 6). case_size is the default pack; the order row offers a dropdown
  // of the real sizes seen on deliveries (cucumber 12/14/16/18) because count boxes
  // vary by delivery — but the item is ONE product at one price regardless of size.
  const { data: eachProds } = await supabase
    .from('products')
    .select('id, case_size')
    .in('category', ['fruit', 'veg'])
    .eq('is_active', true)
    .eq('unit', 'each')
    .gt('case_size', 1)
  const { data: cntMaps } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, units_per_case')
    .eq('unit_type', 'count')
    .gt('units_per_case', 1)
  const sizesBy = new Map<string, Set<number>>()
  for (const m of cntMaps ?? []) {
    if (!m.product_id) continue
    let s = sizesBy.get(m.product_id); if (!s) { s = new Set(); sizesBy.set(m.product_id, s) }
    s.add(Number(m.units_per_case))
  }
  const boxEach: Record<string, number> = {}
  const boxOpts: Record<string, number[]> = {}
  for (const p of eachProds ?? []) {
    const cs = p.case_size as number
    const sizes = new Set<number>(sizesBy.get(p.id) ?? [])
    sizes.add(cs)
    // Keep sizes in a sane band around the canonical pack — drops mis-mapped
    // outliers (e.g. a stray "38" on Cucumber that's really a mini).
    const opts = [...sizes].filter(s => s >= cs * 0.5 && s <= cs * 1.6).sort((a, b) => a - b)
    boxEach[p.id] = cs
    boxOpts[p.id] = opts
  }

  return (
    <ShopOrderBuilder customerId={customer.id} products={products} catalogue={catalogue}
      boxKg={boxKg} boxEach={boxEach} boxOpts={boxOpts} />
  )
}
