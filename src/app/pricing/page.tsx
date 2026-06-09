import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { approveAll, rejectAll, recalculateSuggestions } from './actions'
import { SuggestionCard } from './SuggestionCard'
import { WinsSection } from './WinsSection'
import type { PriceSuggestion, SuggestionStatus } from '@/types'

type Tab  = 'floor' | 'fruit' | 'veg' | 'other' | 'all' | 'wins'
type Sort = 'name' | 'price' | 'margin'
type Dir  = 'asc' | 'desc'

export default async function PricingSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const { tab: tabParam, sort: sortParam, dir: dirParam } = await searchParams
  const tab:  Tab  = (['floor','fruit','veg','other','wins'].includes(tabParam ?? '') ? tabParam as Tab : 'all')
  const sort: Sort = sortParam === 'price' ? 'price' : sortParam === 'margin' ? 'margin' : 'name'
  const dir:  Dir  = dirParam === 'desc' ? 'desc' : 'asc'

  const supabase = await createClient()

  const { data: suggestions } = await supabase
    .from('price_suggestions')
    .select('*, product:products(name, margin_floor, purchase_cost, category)')
    .in('status', ['pending', 'on_hold'])
    .order('created_at', { ascending: false })

  // Opportunities: healthy products between floor (20%) and target (33%) margin
  const TARGET_MARGIN = 0.40
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, category, retail_price, purchase_cost, margin_floor, weekly_units, wins_dismissed_cost')
    .eq('is_active', true)
    .gt('retail_price', 0)
    .gt('purchase_cost', 0)
    .order('name')

  type Opp = { id: string; name: string; category: string; retail_price: number; purchase_cost: number; margin_floor: number; weekly_units: number | null; wins_dismissed_cost: number | null }
  const opportunities = ((allProducts ?? []) as Opp[]).filter(p => {
    const margin = (p.retail_price - p.purchase_cost) / p.retail_price
    if (margin < (p.margin_floor ?? 0.2) || margin >= TARGET_MARGIN) return false
    // Re-show if cost has moved 10p+ since dismissal; otherwise hide
    if (p.wins_dismissed_cost !== null && Math.abs(p.purchase_cost - p.wins_dismissed_cost) < 10) return false
    // Only show if the suggested price is at least 5p above current (filter trivial changes)
    const suggested = Math.ceil(Math.round(p.purchase_cost / (1 - TARGET_MARGIN)) / 5) * 5
    return suggested - p.retail_price >= 5
  })

  type S = PriceSuggestion & {
    product: { name: string; margin_floor: number; purchase_cost: number; category: string }
    status: SuggestionStatus
  }

  const pending = (suggestions ?? []) as S[]
  const pendingCount = pending.filter(s => s.status === 'pending').length

  // Look up most recent confirmed invoice per product (suggestions don't store invoice_id)
  const productIds = pending.map(s => s.product_id).filter(Boolean)
  type InvoiceRef = { id: string; invoice_date: string; supplier_name: string; pdf_url: string | null }
  const invoiceByProduct: Record<string, InvoiceRef> = {}

  if (productIds.length > 0) {
    const { data: invoiceItems } = await supabase
      .from('purchase_invoice_items')
      .select('product_id, invoice:purchase_invoices!inner(id, invoice_date, supplier_name, pdf_url)')
      .in('product_id', productIds)
      .eq('invoice.status', 'processed')
      .order('invoice(invoice_date)', { ascending: false })

    for (const row of invoiceItems ?? []) {
      if (!invoiceByProduct[row.product_id]) {
        const inv = row.invoice as unknown as InvoiceRef
        invoiceByProduct[row.product_id] = inv
      }
    }
  }

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
      <div className="flex items-center gap-3 mb-4">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold flex-1">Price Suggestions</h1>
      </div>

      {pending.length === 0 ? (
        <>
          <div className="card text-center py-10 flex flex-col items-center mb-4">
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
          {opportunities.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-status-green mb-1">💡 Price Wins ({opportunities.length})</h2>
              <WinsSection
                opportunities={opportunities.map(o => ({ ...o, margin_floor: o.margin_floor ?? 0.2 }))}
                description="Products below 40% margin — here's what you'd need to charge to hit 40%."
              />
            </div>
          )}
        </>
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
            {opportunities.length > 0 && (
              <a href={tabHref('wins')}
                className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                  ${tab === 'wins' ? 'bg-status-green/20 ring-1 ring-status-green font-semibold' : 'card'}`}>
                💡 Wins <span className="text-xs opacity-60">({opportunities.length})</span>
              </a>
            )}
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

          {tab === 'wins' ? (
            <WinsSection
              opportunities={opportunities.map(o => ({ ...o, margin_floor: o.margin_floor ?? 0.2 }))}
              description="Shows what you'd need to charge to hit 40% margin. Adjust any price before applying — or leave as is to hide until costs change."
            />
          ) : (
            <>
              <div className="space-y-2">
                {displayed.map((s: S) => {
                  const inv = invoiceByProduct[s.product_id] ?? null
                  return (
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
                      invoiceId={inv?.id ?? null}
                      invoiceDate={inv?.invoice_date ?? null}
                      supplierName={inv?.supplier_name ?? null}
                    />
                  )
                })}
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
        </>
      )}

      <NavBar />
    </div>
  )
}
