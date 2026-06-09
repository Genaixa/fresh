import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { formatPrice } from '@/lib/pricing-engine'
import { marginStatus, TrafficDot } from '@/components/ui/TrafficDot'
import type { Product } from '@/types'

type Tab  = 'fruit' | 'veg' | 'other' | 'all'
type Sort = 'name' | 'markup'
type Dir  = 'asc' | 'desc'

export default async function MarginsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const { tab: tabParam, sort: sortParam, dir: dirParam } = await searchParams
  const tab:  Tab  = (['fruit','veg','other'].includes(tabParam ?? '') ? tabParam as Tab : 'all')
  const sort: Sort = sortParam === 'markup' ? 'markup' : 'name'
  const dir:  Dir  = dirParam === 'desc' ? 'desc' : 'asc'

  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: waste } = await supabase
    .from('waste_log')
    .select('total_cost')
    .gte('created_at', weekAgo)

  const totalWastePence = (waste ?? []).reduce(
    (sum: number, w: { total_cost: number }) => sum + w.total_cost, 0
  )

  const priced = (products ?? []).filter(
    (p: Product) => p.retail_price > 0 && p.purchase_cost > 0
  )

  function markup(p: Product)      { return (p.retail_price - p.purchase_cost) / p.purchase_cost }
  function grossMargin(p: Product) { return (p.retail_price - p.purchase_cost) / p.retail_price  }

  const avgMarkup = priced.length
    ? priced.reduce((s: number, p: Product) => s + markup(p), 0) / priced.length : 0
  const avgGM = priced.length
    ? priced.reduce((s: number, p: Product) => s + grossMargin(p), 0) / priced.length : 0

  const onTarget = priced.filter((p: Product) => marginStatus(grossMargin(p), p.margin_floor) === 'green').length
  const close    = priced.filter((p: Product) => marginStatus(grossMargin(p), p.margin_floor) === 'amber').length
  const low      = priced.filter((p: Product) => marginStatus(grossMargin(p), p.margin_floor) === 'red').length

  const fruitCount = priced.filter((p: Product) => p.category === 'fruit').length
  const vegCount   = priced.filter((p: Product) => p.category === 'veg').length
  const otherCount = priced.filter((p: Product) => p.category === 'other').length

  const tabFiltered = tab === 'all' ? priced
    : priced.filter((p: Product) => p.category === tab)

  const displayed = [...tabFiltered].sort((a: Product, b: Product) => {
    const cmp = sort === 'markup'
      ? markup(a) - markup(b)
      : a.name.localeCompare(b.name)
    return dir === 'desc' ? -cmp : cmp
  })

  function tabHref(t: string) {
    const parts: string[] = []
    if (t !== 'all')     parts.push(`tab=${t}`)
    if (sort !== 'name') parts.push(`sort=${sort}`)
    if (dir  !== 'asc')  parts.push(`dir=${dir}`)
    return `/margins${parts.length ? `?${parts.join('&')}` : ''}`
  }
  function sortHref(s: Sort) {
    const newDir: Dir = s === sort ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
    const parts: string[] = []
    if (tab    !== 'all')  parts.push(`tab=${tab}`)
    if (s      !== 'name') parts.push(`sort=${s}`)
    if (newDir !== 'asc')  parts.push(`dir=${newDir}`)
    return `/margins${parts.length ? `?${parts.join('&')}` : ''}`
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Margins</h1>
        <div className="flex gap-3">
          <Link href="/margins/bulk" className="text-brand-accent text-sm min-h-[44px] flex items-center">Bulk →</Link>
          <Link href="/margins/sim"  className="text-brand-accent text-sm min-h-[44px] flex items-center">Sim →</Link>
        </div>
      </div>

      {/* Summary card */}
      <div className="card mb-4 flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-brand-accent leading-none">
            {(avgMarkup * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            avg markup · {(avgGM * 100).toFixed(1)}% gross margin
          </p>
        </div>
        <div className="text-right text-xs space-y-1">
          <p className="text-status-green font-medium">{onTarget} on target</p>
          {close > 0 && <p className="text-status-amber font-medium">{close} close</p>}
          {low   > 0 && <p className="text-status-red   font-medium">{low} low</p>}
          {totalWastePence > 0 && (
            <p className="text-status-red font-medium">−{formatPrice(totalWastePence)} waste</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-2">
        {(['fruit','veg','other','all'] as const).map(t => {
          const count = t === 'fruit' ? fruitCount : t === 'veg' ? vegCount : t === 'other' ? otherCount : priced.length
          const labels: Record<string, string> = { fruit: 'Fruit', veg: 'Veg', other: 'Other', all: 'All' }
          return (
            <a key={t} href={tabHref(t)}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === t ? 'bg-white/10 ring-1 ring-white/30 font-semibold' : 'card'}`}>
              {labels[t]} <span className="text-xs opacity-60">({count})</span>
            </a>
          )
        })}
      </div>

      {/* Sort */}
      <div className="flex gap-2 mb-3">
        {([['name','A–Z'], ['markup','Markup']] as [Sort, string][]).map(([s, label]) => {
          const active = sort === s
          const arrow  = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
          return (
            <a key={s} href={sortHref(s)}
              className={`px-4 py-1.5 rounded-lg text-xs transition-colors
                ${active
                  ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
                  : 'text-[var(--text-muted)] border border-white/10'}`}>
              {label}{arrow}
            </a>
          )
        })}
        <span className="flex-1" />
        <span className="text-xs text-[var(--text-muted)] flex items-center">
          {displayed.length} products
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {displayed.map((p: Product) => {
          const mu     = markup(p)
          const gm     = grossMargin(p)
          const status = marginStatus(gm, p.margin_floor)
          return (
            <div key={p.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <TrafficDot status={status} />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    cost {formatPrice(p.purchase_cost)} · retail {formatPrice(p.retail_price)}
                  </p>
                </div>
              </div>
              <p className={`font-semibold text-sm ml-3 shrink-0 ${
                status === 'green' ? 'text-status-green' :
                status === 'amber' ? 'text-status-amber' : 'text-status-red'
              }`}>
                {mu >= 0 ? '+' : ''}{(mu * 100).toFixed(0)}%
              </p>
            </div>
          )
        })}
      </div>

      <NavBar />
    </div>
  )
}
