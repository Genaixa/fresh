import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { confirmInvoiceAndGeneratePrices, rematchInvoiceItems, saveInvoiceNumber } from './actions'
import type { PurchaseInvoiceItem, Product } from '@/types'
import { formatPrice } from '@/lib/pricing-engine'
import { getInvoiceAnomalies } from '@/lib/data-health'

type Tab  = 'fruit' | 'veg' | 'other' | 'all'
type Sort = 'name' | 'price'
type Dir  = 'asc' | 'desc'

export default async function ReviewInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; sort?: string; dir?: string }>
}) {
  const { id } = await params
  const { tab: tabParam, sort: sortParam, dir: dirParam } = await searchParams
  const tab:  Tab  = (['fruit','veg','other'].includes(tabParam ?? '') ? tabParam as Tab : 'all')
  const sort: Sort = sortParam === 'price' ? 'price' : 'name'
  const dir:  Dir  = dirParam === 'desc' ? 'desc' : 'asc'

  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('purchase_invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  let pdfSignedUrl: string | null = null
  if (invoice.pdf_url) {
    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.pdf_url, 3600)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('*, product:products(id, name, category)')
    .eq('invoice_id', id)

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  type Item = PurchaseInvoiceItem & { product: (Product & { category: string }) | null }

  const allMatched   = (items ?? []).filter((i: Item) =>  i.is_matched) as Item[]
  const allUnmatched = (items ?? []).filter((i: Item) => !i.is_matched) as Item[]

  const anomalies = await getInvoiceAnomalies(supabase, id)

  // Filter matched by tab
  const tabFiltered = tab === 'all'
    ? allMatched
    : allMatched.filter((i: Item) => i.product?.category === tab)

  // Sort
  const displayed = [...tabFiltered].sort((a: Item, b: Item) => {
    let cmp = 0
    if (sort === 'price') cmp = (a.unit_cost ?? 0) - (b.unit_cost ?? 0)
    else cmp = (a.product?.name ?? a.product_name_raw ?? '').localeCompare(
                b.product?.name ?? b.product_name_raw ?? '')
    return dir === 'desc' ? -cmp : cmp
  })

  const fruitCount = allMatched.filter((i: Item) => i.product?.category === 'fruit').length
  const vegCount   = allMatched.filter((i: Item) => i.product?.category === 'veg').length
  const otherCount = allMatched.filter((i: Item) => i.product?.category === 'other').length

  function tabHref(t: string) {
    const parts: string[] = []
    if (t !== 'all')     parts.push(`tab=${t}`)
    if (sort !== 'name') parts.push(`sort=${sort}`)
    if (dir  !== 'asc')  parts.push(`dir=${dir}`)
    return `?${parts.join('&')}`
  }
  function sortHref(s: Sort) {
    const newDir: Dir = s === sort ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
    const parts: string[] = []
    if (tab  !== 'all')   parts.push(`tab=${tab}`)
    if (s    !== 'name')  parts.push(`sort=${s}`)
    if (newDir !== 'asc') parts.push(`dir=${newDir}`)
    return `?${parts.join('&')}`
  }

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/invoices" className="text-brand-accent min-h-[48px] min-w-[48px]
                                           flex items-center justify-center text-xl">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Review Invoice</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {invoice.supplier_name} · {new Date(invoice.invoice_date).toLocaleDateString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </p>
        </div>
        {pdfSignedUrl && (
          <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center justify-center min-w-[48px] min-h-[48px]
                       text-brand-accent text-xs gap-0.5 shrink-0">
            <span className="text-xl leading-none">📄</span>
            <span>PDF</span>
          </a>
        )}
      </div>

      {/* Invoice number */}
      <form
        action={saveInvoiceNumber.bind(null, id)}
        className="card flex items-center gap-3 mb-4 py-2.5 px-3"
      >
        <span className="text-xs text-[var(--text-muted)] shrink-0">Invoice ref</span>
        <input
          name="invoice_number"
          defaultValue={invoice.invoice_number ?? ''}
          placeholder="e.g. DN-123456"
          className="flex-1 bg-transparent text-sm font-mono font-semibold outline-none placeholder:text-[var(--text-muted)]"
        />
        <button type="submit" className="text-xs text-brand-accent shrink-0 px-2 py-1 rounded-lg border border-brand-accent/30">
          Save
        </button>
      </form>

      {/* Matched / Unmatched summary */}
      <div className="card mb-4 flex gap-4">
        <div className="flex-1 text-center rounded-xl py-2">
          <p className="text-2xl font-bold text-status-green">{allMatched.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Matched</p>
        </div>
        <div className="flex-1 text-center rounded-xl py-2">
          <p className={`text-2xl font-bold ${allUnmatched.length > 0 ? 'text-status-amber' : 'text-[var(--text-muted)]'}`}>
            {allUnmatched.length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Unmatched</p>
        </div>
        <div className="flex-1 text-center rounded-xl py-2">
          <p className="text-2xl font-bold">{(items ?? []).length}</p>
          <p className="text-xs text-[var(--text-muted)]">All</p>
        </div>
      </div>

      {/* Unmatched items */}
      {allUnmatched.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title text-status-amber mb-0">⚠ Unmatched items</p>
            <form action={rematchInvoiceItems.bind(null, id)}>
              <button type="submit"
                className="text-xs text-brand-accent border border-brand-accent/40
                           rounded-lg px-3 py-1.5 min-h-[36px] active:scale-95 transition-transform">
                Auto-match
              </button>
            </form>
          </div>
          <div className="space-y-2">
            {allUnmatched.map((item: Item) => (
              <div key={item.id} className="card border border-status-amber/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{item.product_name_raw}</p>
                  <p className="text-sm">{formatPrice(item.unit_cost)}</p>
                </div>
                <form action={`/api/invoices/items/${item.id}/map`} method="POST"
                      className="flex gap-2">
                  <select name="product_id" className="input-field text-sm py-2 flex-1">
                    <option value="">— Skip this item —</option>
                    {(products ?? []).map((p: { id: string; name: string }) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button type="submit"
                    className="btn-primary px-4 py-2 text-sm min-h-[44px]">
                    Map
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category tabs + sort */}
      {allMatched.length > 0 && (
        <>
          <div className="flex gap-2 mb-2">
            <Link href={tabHref('fruit')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'fruit' ? 'bg-status-green/20 ring-1 ring-status-green font-semibold' : 'card'}`}>
              Fruit <span className="text-xs opacity-60">({fruitCount})</span>
            </Link>
            <Link href={tabHref('veg')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'veg' ? 'bg-status-green/20 ring-1 ring-status-green font-semibold' : 'card'}`}>
              Veg <span className="text-xs opacity-60">({vegCount})</span>
            </Link>
            {otherCount > 0 && (
              <Link href={tabHref('other')}
                className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                  ${tab === 'other' ? 'bg-black/5 ring-1 ring-brand-accent font-semibold' : 'card'}`}>
                Other <span className="text-xs opacity-60">({otherCount})</span>
              </Link>
            )}
            <Link href={tabHref('all')}
              className={`flex-1 text-center rounded-xl py-2 text-sm transition-colors
                ${tab === 'all' ? 'bg-black/5 ring-1 ring-brand-accent font-semibold' : 'card'}`}>
              All <span className="text-xs opacity-60">({allMatched.length})</span>
            </Link>
          </div>

          {/* Sort toggle */}
          <div className="flex gap-2 mb-3">
            {(['name', 'price'] as Sort[]).map(s => {
              const active = sort === s
              const arrow  = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
              const label  = s === 'name' ? 'A–Z' : 'Price'
              return (
                <Link key={s} href={sortHref(s)}
                  className={`px-4 py-1.5 rounded-lg text-xs transition-colors
                    ${active ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
                             : 'text-[var(--text-muted)] border border-[var(--border)]'}`}>
                  {label}{arrow}
                </Link>
              )
            })}
          </div>

          <div className="space-y-2 mb-6">
            {displayed.map((item: Item) => {
              const boxLabel = item.unit_type === 'weight' && item.box_weight_kg
                ? `${item.box_weight_kg}kg box`
                : item.unit_type === 'count' && item.units_per_case
                ? `${item.units_per_case} per box`
                : null
              const anomaly = anomalies.get(item.id)
              const anomalyColour = anomaly
                ? anomaly.changePct < 0 ? 'text-status-red' : 'text-status-amber'
                : null
              const anomalyLabel = anomaly
                ? anomaly.changePct < 0
                  ? `⚠ ${Math.abs(anomaly.changePct)}% below usual (avg ${formatPrice(anomaly.benchmarkCost)})`
                  : `↑ ${anomaly.changePct}% above usual (avg ${formatPrice(anomaly.benchmarkCost)})`
                : null

              return (
                <div key={item.id}
                  className={`card flex items-center justify-between ${anomaly ? 'border border-status-amber/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{item.product?.name ?? item.product_name_raw}</p>
                    {boxLabel && <p className="text-xs text-[var(--text-muted)]">{boxLabel}</p>}
                    {anomalyLabel && (
                      <p className={`text-xs mt-0.5 font-medium ${anomalyColour}`}>
                        {anomalyLabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className={`font-semibold ${anomalyColour ?? ''}`}>{formatPrice(item.unit_cost)}</p>
                    <p className="text-xs text-[var(--text-muted)]">× {item.quantity}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Confirm CTA */}
      <form action={confirmInvoiceAndGeneratePrices.bind(null, id)}>
        <button className="btn-primary w-full text-base">
          Confirm & Generate Price Suggestions
        </button>
      </form>
    </div>
  )
}
