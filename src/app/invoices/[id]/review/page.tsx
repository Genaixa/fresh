import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { confirmInvoiceAndGeneratePrices, rematchInvoiceItems } from './actions'
import type { PurchaseInvoiceItem, Product } from '@/types'
import { formatPrice } from '@/lib/pricing-engine'

export default async function ReviewInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ show?: string }>
}) {
  const { id } = await params
  const { show } = await searchParams
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('purchase_invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('*, product:products(id,name)')
    .eq('invoice_id', id)
    .order('product_name_raw')

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const allMatched   = (items ?? []).filter((i: PurchaseInvoiceItem) => i.is_matched)
  const allUnmatched = (items ?? []).filter((i: PurchaseInvoiceItem) => !i.is_matched)

  // Filter display based on ?show= param
  const matched   = show === 'matched'   ? allMatched   : allMatched
  const unmatched = show === 'unmatched' ? allUnmatched : allUnmatched
  const showMatched   = !show || show === 'matched'
  const showUnmatched = !show || show === 'unmatched'

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/invoices" className="text-brand-accent min-h-[48px] min-w-[48px]
                                           flex items-center justify-center text-xl">
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold">Review Invoice</h1>
          <p className="text-xs text-[var(--text-muted)]">{invoice.supplier_name}</p>
        </div>
      </div>

      {/* Summary — tap to filter */}
      <div className="card mb-6 flex gap-4">
        <Link href={show === 'matched' ? `?` : `?show=matched`}
          className={`flex-1 text-center rounded-xl py-2 transition-colors
            ${show === 'matched' ? 'bg-status-green/20 ring-1 ring-status-green' : 'active:bg-white/5'}`}>
          <p className="text-2xl font-bold text-status-green">{allMatched.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Matched</p>
        </Link>
        <Link href={show === 'unmatched' ? `?` : `?show=unmatched`}
          className={`flex-1 text-center rounded-xl py-2 transition-colors
            ${show === 'unmatched' ? 'bg-status-amber/20 ring-1 ring-status-amber' : 'active:bg-white/5'}`}>
          <p className="text-2xl font-bold text-status-amber">{allUnmatched.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Unmatched</p>
        </Link>
        <Link href="?"
          className={`flex-1 text-center rounded-xl py-2 transition-colors
            ${!show ? 'bg-white/10 ring-1 ring-white/30' : 'active:bg-white/5'}`}>
          <p className="text-2xl font-bold">{(items ?? []).length}</p>
          <p className="text-xs text-[var(--text-muted)]">All</p>
        </Link>
      </div>

      {/* Unmatched items — need attention first */}
      {showUnmatched && allUnmatched.length > 0 && (
        <div className="mb-6">
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
            {unmatched.map((item: PurchaseInvoiceItem & { product: Product | null }) => (
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

      {/* Matched items */}
      {showMatched && allMatched.length > 0 && <div className="mb-6">
        <p className="section-title">✓ Matched items</p>
        <div className="space-y-2">
          {allMatched.map((item: PurchaseInvoiceItem & { product: Product | null }) => {
            const boxLabel = item.unit_type === 'weight' && item.box_weight_kg
              ? `${item.box_weight_kg}kg box`
              : item.unit_type === 'count' && item.units_per_case
              ? `${item.units_per_case} per box`
              : null
            return (
              <div key={item.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{item.product?.name ?? item.product_name_raw}</p>
                  {boxLabel && (
                    <p className="text-xs text-[var(--text-muted)]">{boxLabel}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(item.unit_cost)}</p>
                  <p className="text-xs text-[var(--text-muted)]">× {item.quantity}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>}

      {/* Confirm CTA */}
      <form action={confirmInvoiceAndGeneratePrices.bind(null, id)}>
        <button className="btn-primary w-full text-base">
          Confirm & Generate Price Suggestions
        </button>
      </form>
    </div>
  )
}
