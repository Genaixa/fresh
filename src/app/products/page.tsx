import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { TrafficDot, marginStatus } from '@/components/ui/TrafficDot'
import { formatPrice } from '@/lib/pricing-engine'
import { SearchBox } from './SearchBox'
import type { Product } from '@/types'

type Sort = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>
}) {
  const { category, q, sort: sortParam } = await searchParams
  const sort: Sort =
    sortParam === 'name_desc'  ? 'name_desc'  :
    sortParam === 'price_asc'  ? 'price_asc'  :
    sortParam === 'price_desc' ? 'price_desc' : 'name_asc'
  const supabase = await createClient()

  const showIssues = category === 'issues'

  // Always fetch all active products — category/search filtered in JS so
  // the Issues count badge is always computed from the full catalogue.
  const { data: allProducts } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  function isIssue(p: Product) {
    if (p.margin_floor < 0) return false
    if (p.retail_price === 0 && p.purchase_cost > 0) return true
    if (p.retail_price > 0 && p.purchase_cost > p.retail_price) return true
    if (p.retail_price > 0 && p.purchase_cost > 0) {
      return (p.retail_price - p.purchase_cost) / p.retail_price < p.margin_floor
    }
    return false
  }

  const products = (allProducts ?? [])
    .filter((p: Product) => {
      if (showIssues)                     return isIssue(p)
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
      if (category && category !== 'all') return p.category === category
      return true
    })
    .sort((a: Product, b: Product) => {
      if (sort === 'price_asc')  return a.retail_price - b.retail_price
      if (sort === 'price_desc') return b.retail_price - a.retail_price
      if (sort === 'name_desc')  return b.name.localeCompare(a.name)
      return a.name.localeCompare(b.name)
    })

  function sortHref(s: Sort) {
    const parts: string[] = []
    if (category) parts.push(`category=${category}`)
    if (q)        parts.push(`q=${q}`)
    if (s !== 'name_asc') parts.push(`sort=${s}`)
    return `/products${parts.length ? `?${parts.join('&')}` : ''}`
  }

  // Toggle logic: clicking active sort flips direction; clicking new sort resets
  const nameNextSort: Sort = sort === 'name_asc' ? 'name_desc' : 'name_asc'
  const priceNextSort: Sort = sort === 'price_asc' ? 'price_desc' : 'price_asc'
  const nameActive  = sort === 'name_asc' || sort === 'name_desc'
  const priceActive = sort === 'price_asc' || sort === 'price_desc'

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Products</h1>
        <Link href="/products/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Add
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchBox defaultValue={q} />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'fruit', 'veg', 'other'].map(cat => (
          <Link
            key={cat}
            href={`/products?category=${cat}${q ? `&q=${q}` : ''}${sort !== 'name_asc' ? `&sort=${sort}` : ''}`}
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
          const issueCount = (allProducts ?? []).filter(isIssue).length
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

      {/* Sort toggle buttons */}
      <div className="flex gap-2 mb-4">
        <Link href={sortHref(nameNextSort)}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${nameActive
              ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
              : 'text-[var(--text-muted)] border border-white/10'}`}>
          A–Z {nameActive ? (sort === 'name_asc' ? '↑' : '↓') : ''}
        </Link>
        <Link href={sortHref(priceNextSort)}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${priceActive
              ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
              : 'text-[var(--text-muted)] border border-white/10'}`}>
          Price {priceActive ? (sort === 'price_asc' ? '↑' : '↓') : ''}
        </Link>
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {(products ?? []).map((p: Product) => {
          const margin = p.retail_price > 0
            ? (p.retail_price - p.purchase_cost) / p.retail_price
            : 0
          const dot = marginStatus(margin, p.margin_floor, p.retail_price, p.purchase_cost)

          const isLossLeader = p.margin_floor < 0
          const atLoss       = !isLossLeader && p.retail_price > 0 && p.purchase_cost > p.retail_price
          const unpriced     = p.retail_price === 0 && p.purchase_cost > 0

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
                    {isLossLeader ? <span className="text-[var(--text-muted)]">loss leader</span>
                    : atLoss      ? <span className="text-status-red font-semibold">at a loss</span>
                    : unpriced    ? <span className="text-status-amber">unpriced</span>
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
