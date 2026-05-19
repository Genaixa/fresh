import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/pricing-engine'
import { costStatus, TrafficDot } from '@/components/ui/TrafficDot'
import type { Product, PriceHistoryEntry } from '@/types'

export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>
}) {
  const { product_id } = await searchParams
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  let history: (PriceHistoryEntry & { product: { name: string } })[] = []
  let selected: { id: string; name: string } | null = null
  let avg4wk = 0

  if (product_id) {
    selected = (products ?? []).find((p: { id: string }) => p.id === product_id) ?? null

    const { data } = await supabase
      .from('price_history')
      .select('*, product:products(name)')
      .eq('product_id', product_id)
      .eq('price_type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(20)

    history = (data ?? []) as typeof history

    // 4-week rolling average
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    const recent = history.filter(h => new Date(h.created_at) >= fourWeeksAgo)
    avg4wk = recent.length
      ? Math.round(recent.reduce((sum, h) => sum + h.new_price, 0) / recent.length)
      : history[0]?.new_price ?? 0
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Price History</h1>
      </div>

      {/* Product selector */}
      <form className="mb-6">
        <select name="product_id" defaultValue={product_id ?? ''}
          onChange={(e) => { (e.target as HTMLSelectElement).form?.submit() }}
          className="input-field"
        >
          <option value="">— Select a product —</option>
          {(products ?? []).map((p: { id: string; name: string }) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <noscript><button type="submit" className="btn-primary w-full mt-2">Go</button></noscript>
      </form>

      {selected && history.length > 0 && (
        <>
          <div className="card mb-4 flex gap-6">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Today</p>
              <p className="text-xl font-bold">{formatPrice(history[0].new_price)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">4-wk avg</p>
              <p className="text-xl font-bold">{formatPrice(avg4wk)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Min (20)</p>
              <p className="text-xl font-bold">
                {formatPrice(Math.min(...history.map(h => h.new_price)))}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {history.map(h => {
              const status = costStatus(h.new_price, avg4wk)
              return (
                <div key={h.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrafficDot status={status} />
                    <p className="text-sm">
                      {new Date(h.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <p className="font-semibold">{formatPrice(h.new_price)}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selected && history.length === 0 && (
        <p className="text-center text-[var(--text-muted)] py-8">
          No purchase price history yet for this product.
        </p>
      )}
    </div>
  )
}
