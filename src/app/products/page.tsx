import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { TrafficDot, marginStatus } from '@/components/ui/TrafficDot'
import { formatPrice } from '@/lib/pricing-engine'
import type { Product } from '@/types'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const { category, q } = await searchParams
  const supabase = await createClient()

  const showIssues = category === 'issues'

  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  if (!showIssues) {
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (q) {
      query = query.ilike('name', `%${q}%`)
    }
  }

  const { data: allProducts } = await query

  // Issues tab: at-loss + below margin floor + unpriced (all non-intentional)
  const products = showIssues
    ? (allProducts ?? []).filter((p: Product) => {
        if (p.margin_floor < 0) return false  // intentional loss leaders excluded
        if (p.retail_price === 0 && p.purchase_cost > 0) return true  // unpriced
        if (p.retail_price > 0 && p.purchase_cost > p.retail_price) return true  // at a loss
        if (p.retail_price > 0 && p.purchase_cost > 0) {
          const margin = (p.retail_price - p.purchase_cost) / p.retail_price
          if (margin < p.margin_floor) return true  // below floor
        }
        return false
      })
    : (allProducts ?? [])

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Products</h1>
        <Link href="/products/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Add
        </Link>
      </div>

      {/* Search */}
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products..."
          className="w-full rounded-xl border border-white/10 bg-[var(--bg-card)]
                     px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                     focus:outline-none focus:ring-2 focus:ring-brand-accent"
        />
      </form>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'fruit', 'veg', 'other'].map(cat => (
          <Link
            key={cat}
            href={`/products?category=${cat}${q ? `&q=${q}` : ''}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap min-h-[36px]
                        flex items-center
                        ${(category ?? 'all') === cat
                          ? 'bg-brand-accent text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Link>
        ))}
        {(() => {
          const issueCount = (allProducts ?? []).filter((p: Product) => {
            if (p.margin_floor < 0) return false
            if (p.retail_price === 0 && p.purchase_cost > 0) return true
            if (p.retail_price > 0 && p.purchase_cost > p.retail_price) return true
            if (p.retail_price > 0 && p.purchase_cost > 0) {
              return (p.retail_price - p.purchase_cost) / p.retail_price < p.margin_floor
            }
            return false
          }).length
          if (issueCount === 0) return null
          return (
            <Link
              href="/products?category=issues"
              className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap min-h-[36px]
                          flex items-center gap-1.5
                          ${showIssues
                            ? 'bg-status-red text-white'
                            : 'bg-status-red/15 text-status-red'}`}
            >
              ⚠ Issues
              <span className={`rounded-full text-xs px-1.5 py-0.5 font-bold
                ${showIssues ? 'bg-white/20' : 'bg-status-red/20'}`}>
                {issueCount}
              </span>
            </Link>
          )
        })()}
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {(products ?? []).map((p: Product) => {
          const margin = p.retail_price > 0
            ? (p.retail_price - p.purchase_cost) / p.retail_price
            : 0
          const dot = marginStatus(margin, p.margin_floor, p.retail_price, p.purchase_cost)

          const atLoss   = p.retail_price > 0 && p.purchase_cost > p.retail_price
          const unpriced = p.retail_price === 0 && p.purchase_cost > 0

          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="card flex items-center justify-between min-h-[56px]
                         active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <TrafficDot status={dot} />
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--text-muted)] capitalize">
                    {atLoss   ? <span className="text-status-red font-semibold">at a loss</span>
                    : unpriced ? <span className="text-status-amber">unpriced</span>
                    : <>{p.category} · {p.unit}</>}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{p.retail_price > 0 ? formatPrice(p.retail_price) : '—'}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {p.purchase_cost > 0 ? `cost ${formatPrice(p.purchase_cost)}` : 'no cost'}
                </p>
              </div>
            </Link>
          )
        })}

        {(products ?? []).length === 0 && (
          <p className="text-center text-[var(--text-muted)] py-12">
            No products found.
          </p>
        )}
      </div>

      <NavBar />
    </div>
  )
}
