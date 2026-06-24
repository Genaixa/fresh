import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { suggestedWholesalePrice } from '@/lib/wholesale-pricing'
import type { Product } from '@/types'
import ResultsTable, { type TradeRow } from './ResultsTable'

export default async function PriceLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let rows: TradeRow[] = []

  if (q && q.trim()) {
    // Match each word of the query, tolerant of plurals ("cucumbers" → "cucumber",
    // "tomatoes" → "tomato", "berries" → "berr"). A product matches if it contains
    // every search stem, so "red pepper" finds "Pepper (Red)".
    const stems = q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) =>
        w.endsWith('ies') ? w.slice(0, -3)
        : w.endsWith('es') ? w.slice(0, -2)
        : w.endsWith('s')  ? w.slice(0, -1)
        : w
      )

    let query = supabase.from('products').select('*').eq('is_active', true)
    for (const stem of stems) {
      query = query.ilike('name', `%${stem}%`)
    }
    const { data: products } = await query.order('name').limit(50)

    if (products && products.length > 0) {
      const ids = (products as Product[]).map((p) => p.id)

      // Latest matched invoice box cost per product — the reliable wholesale input
      // (NOT purchase_cost × case_size, which mixed in calibre data → the £110 bug).
      const { data: items } = await supabase
        .from('purchase_invoice_items')
        .select('product_id, unit_cost, purchase_invoices!inner(invoice_date)')
        .in('product_id', ids)

      const latest = new Map<string, { cost: number; date: string }>()
      for (const it of items ?? []) {
        const pid = it.product_id as string | null
        const date = (it.purchase_invoices as unknown as { invoice_date: string })?.invoice_date
        if (!pid || !date) continue
        const cur = latest.get(pid)
        if (!cur || date > cur.date) latest.set(pid, { cost: it.unit_cost as number, date })
      }

      rows = (products as Product[]).map((p) => {
        const box = latest.get(p.id) ?? null
        const boxCost = box?.cost ?? null
        const trade = suggestedWholesalePrice({
          name: p.name,
          unitType: 'box',
          retailPence: p.retail_price,
          boxCostPence: boxCost,
        })
        return {
          name: p.name,
          unit: p.unit,
          boxCost,
          trade,
          tradeMargin: boxCost && boxCost > 0 && trade > 0 ? (trade - boxCost) / trade : null,
          retail: p.retail_price,
          retailMargin:
            p.retail_price > 0 && p.purchase_cost > 0
              ? (p.retail_price - p.purchase_cost) / p.retail_price
              : null,
          retailApprox: p.unit !== 'kg', // per-each cost unreliable until box-counts cleaned
          lastSeen: box?.date ?? null,
        }
      })
    }
  }

  return (
    <div className="page pb-24">
      {/* Header — matches the rest of the app */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Price Lookup</h1>
          <p className="text-sm text-[var(--text-muted)]">Wholesale box prices &amp; margins</p>
        </div>
        <form action={logout}>
          <button className="text-[var(--text-muted)] text-sm min-h-[48px] min-w-[48px]
                             flex items-center justify-center">
            Sign out
          </button>
        </form>
      </div>

      {/* Search */}
      <form className="mb-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search product…"
          autoFocus
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                     px-4 py-4 text-xl text-[var(--text)] min-h-[60px]
                     focus:outline-none focus:ring-2 focus:ring-brand-accent"
        />
      </form>

      {/* Results */}
      {rows.length > 0 ? (
        <ResultsTable rows={rows} />
      ) : q ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No products found</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Try a different search</p>
        </div>
      ) : (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🥦</p>
          <p className="text-[var(--text-muted)]">Type a product name above</p>
        </div>
      )}
    </div>
  )
}
