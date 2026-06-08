import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { approveAll, rejectAll, recalculateSuggestions } from './actions'
import { SuggestionCard } from './SuggestionCard'
import type { PriceSuggestion, SuggestionStatus } from '@/types'

type Tab  = 'floor' | 'fruit' | 'veg' | 'other' | 'all'
type Sort = 'name' | 'price' | 'margin'
type Dir  = 'asc' | 'desc'

export default async function PricingSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const { tab: tabParam, sort: sortParam, dir: dirParam } = await searchParams
  const tab:  Tab  = (['floor','fruit','veg','other'].includes(tabParam ?? '') ? tabParam as Tab : 'all')
  const sort: Sort = sortParam === 'price' ? 'price' : sortParam === 'margin' ? 'margin' : 'name'
  const dir:  Dir  = dirParam === 'desc' ? 'desc' : 'asc'

  const supabase = await createClient()

  const { data: suggestions } = await supabase
    .from('price_suggestions')
    .select('*, product:products(name, margin_floor, purchase_cost, category)')
    .in('status', ['pending', 'on_hold'])
    .order('created_at', { ascending: false })

  type S = PriceSuggestion & { product: { name: string; margin_floor: number; purchase_cost: number; category: string }; status: SuggestionStatus }

  const pending = (suggestions ?? []) as S[]
  const pendingCount = pending.filter(s => s.status === 'pending').length

  function isCurrentlyBelowFloor(s: S): boolean {
    const cost  = s.product?.purchase_cost ?? 0
    const floor = s.product?.margin_floor  ?? 0.2
    if (s.current_retail_price === 0) return false
    return (s.current_retail_price - cost) / s.current_retail_price < floor
  }

  const floorCount = pending.filter(s => isCurrentlyBelowFloor(s) || s.current_retail_price === 0).length
  const fruitCount = pending.filter(s => s.product?.category === 'fruit').length
  const vegCount   = pending.filter(s => s.product?.category === 'veg').length
  const otherCount = pending.filter(s => s.product?.category === 'other').length

  const tabFiltered =
    tab === 'floor' ? pending.filter(s => isCurrentlyBelowFloor(s) || s.current_retail_price === 0) :
    tab === 'all'   ? pending :
    pending.filter(s => s.product?.category === tab)

  const displayed = [...tabFiltered].sort((a, b) => {
    let cmp = 0
    if (sort === 'price')  cmp = a.suggested_retail_price - b.suggested_retail_price
    else if (sort === 'margin') {
      const ma = a.current_retail_price > 0 ? (a.current_retail_price - (a.product?.purchase_cost ?? 0)) / a.current_retail_price : -1
      const mb = b.current_retail_price > 0 ? (b.current_retail_price - (b.product?.purchase_cost ?? 0)) / b.current_retail_price : -1
      cmp = ma - mb
    } else cmp = (a.product?.name ?? '').localeCompare(b.product?.name ?? '')
    return dir === 'desc' ? -cmp : cmp
  })

  function tabHref(t: string) {
    const parts: string[] = []
    if (t !== 'all') parts.push(`tab=${t}`)
    if (sort !== 'name') parts.push(`sort=${sort}`)
    if (dir  !== 'asc')  parts.push(`dir=${dir}`)
    return `/pricing${parts.length ? `?${parts.join('&')}` : ''}`
  }
  function sortHref(s: Sort) {
    // Clicking the active sort toggles direction; clicking a new sort resets to asc
    const newDir: Dir = s === sort ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
    const parts: string[] = []
    if (tab  !== 'all')  parts.push(`tab=${tab}`)
    if (s    !== 'name') parts.push(`sort=${s}`)
    if (newDir !== 'asc') parts.push(`dir=${newDir}`)
    return `/pricing${parts.length ? `?${parts.join('&')}` : ''}`
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Price Suggestions</h1>
      </div>

      {pending.length === 0 ? (
        <div className="card text-center py-12 flex flex-col items-center">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-semibold">All prices up to date</p>
          <p className="text-sm text-[var(--text-muted)] mt-1 mb-2">
            New suggestions appear automatically when you confirm a delivery note.
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-6 max-w-xs">
            Use the button below to re-check all products against their current costs —
            useful if you&apos;ve manually updated a cost without going through an invoice.
          </p>
          <form action={recalculateSuggestions}>
            <button className="btn-primary px-6 py-2.5 text-sm">
              Recalculate from current costs
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 mb-2">
            {floorCount > 0 && (
              <a href={tabHref('floor')}
                className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                  ${tab === 'floor' ? 'bg-status-amber/20 ring-1 ring-status-amber font-semibold' : 'card'}`}>
                ⚠ Urgent <span className="text-xs opacity-80">({floorCount})</span>
              </a>
            )}
            <a href={tabHref('fruit')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'fruit' ? 'bg-status-green/20 ring-1 ring-status-green font-semibold' : 'card'}`}>
              Fruit <span className="text-xs opacity-60">({fruitCount})</span>
            </a>
            <a href={tabHref('veg')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'veg' ? 'bg-status-green/20 ring-1 ring-status-green font-semibold' : 'card'}`}>
              Veg <span className="text-xs opacity-60">({vegCount})</span>
            </a>
            {otherCount > 0 && (
              <a href={tabHref('other')}
                className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                  ${tab === 'other' ? 'bg-white/10 ring-1 ring-white/30 font-semibold' : 'card'}`}>
                Other <span className="text-xs opacity-60">({otherCount})</span>
              </a>
            )}
            <a href={tabHref('all')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'all' ? 'bg-white/10 ring-1 ring-white/30 font-semibold' : 'card'}`}>
              All <span className="text-xs opacity-60">({pending.length})</span>
            </a>
          </div>

          {/* Sort toggle */}
          <div className="flex gap-2 mb-3">
            {(['name', 'price', 'margin'] as Sort[]).map(s => {
              const active  = sort === s
              const arrow   = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
              const labels  = { name: 'A–Z', price: 'Price', margin: 'Margin' }
              return (
                <a key={s} href={sortHref(s)}
                  className={`px-4 py-1.5 rounded-lg text-xs transition-colors
                    ${active ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
                             : 'text-[var(--text-muted)] border border-white/10'}`}>
                  {labels[s]}{arrow}
                </a>
              )
            })}
          </div>

          <div className="space-y-2">
            {displayed.map((s: S) => (
              <SuggestionCard
                key={s.id}
                id={s.id}
                productName={s.product?.name ?? ''}
                currentRetailPrice={s.current_retail_price}
                suggestedRetailPrice={s.suggested_retail_price}
                costPence={s.product?.purchase_cost ?? 0}
                marginWarning={s.margin_warning}
                marginFloor={s.product?.margin_floor ?? 0.2}
                isHeld={s.status === 'on_hold'}
              />
            ))}
          </div>

          {/* Bulk actions */}
          <div className="flex gap-3 mt-6">
            <form action={approveAll} className="flex-1">
              <button
                className="btn-primary w-full py-3 text-sm disabled:opacity-40"
                disabled={pendingCount === 0}
              >
                ✓ Approve All{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            </form>
            <form action={rejectAll} className="flex-1">
              <button
                className="w-full py-3 rounded-xl border border-status-red/40 text-status-red text-sm active:bg-status-red/10 transition-colors disabled:opacity-40"
                disabled={pendingCount === 0}
              >
                ✗ Reject All
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-4">
            {displayed.length} shown · {pendingCount} ready · {pending.length - pendingCount} on hold · {floorCount} below floor
          </p>
        </>
      )}

      <NavBar />
    </div>
  )
}
