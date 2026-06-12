import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/pricing-engine'
import type { Product, WasteEntry } from '@/types'
import { WastePicker } from './WastePicker'

export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<{ product_id?: string }>
}) {
  const { product_id } = await searchParams
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, purchase_cost')
    .eq('is_active', true)
    .order('name')

  const { data: recent } = await supabase
    .from('waste_log')
    .select('*, product:products(name)')
    .order('created_at', { ascending: false })
    .limit(10)

  // "Often wasted" — frequency over the last ~300 entries drives the quick-tap grid
  const { data: freqRows } = await supabase
    .from('waste_log')
    .select('product_id')
    .order('created_at', { ascending: false })
    .limit(300)
  const freqCount = new Map<string, number>()
  for (const w of freqRows ?? []) {
    if (w.product_id) freqCount.set(w.product_id, (freqCount.get(w.product_id) ?? 0) + 1)
  }
  const frequentIds = [...freqCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id)

  const selected = (products ?? []).find((p: { id: string }) => p.id === product_id) as
    (Product & { id: string; name: string; purchase_cost: number }) | undefined

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Log Waste</h1>
      </div>

      {/* Product picker: live name search, often-wasted first, full catalogue on tap */}
      <WastePicker
        products={(products ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))}
        frequentIds={frequentIds}
        selectedId={product_id}
      />

      {/* Waste entry form */}
      {selected && (
        <div className="card mb-6 border-2 border-brand-accent/40">
          <p className="font-bold text-lg mb-4">{selected.name}</p>
          <form action="/api/waste/log" method="POST" className="space-y-4">
            <input type="hidden" name="product_id" value={selected.id} />
            <input type="hidden" name="unit_cost" value={selected.purchase_cost} />

            <div>
              <p className="text-sm font-medium mb-2 text-[var(--text-muted)]">Quantity</p>
              <div className="flex items-center gap-4">
                <button type="button" id="qty-minus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-white/10 text-2xl
                             flex items-center justify-center font-bold">−</button>
                <input id="qty-input" name="quantity" type="number" min="0.5" step="0.5"
                       defaultValue={1}
                       className="w-20 text-center text-2xl font-bold bg-transparent
                                  border-b-2 border-brand-accent focus:outline-none" />
                <button type="button" id="qty-plus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-white/10 text-2xl
                             flex items-center justify-center font-bold">+</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2 text-[var(--text-muted)]">Reason</p>
              <div className="grid grid-cols-2 gap-2">
                {(['spoiled', 'damaged', 'markdown', 'other'] as const).map(r => (
                  <label key={r} className="cursor-pointer">
                    <input type="radio" name="reason" value={r}
                           defaultChecked={r === 'spoiled'} className="sr-only peer" />
                    <div className="min-h-[48px] rounded-xl border-2 border-white/10
                                    peer-checked:border-brand-accent peer-checked:bg-brand-accent/10
                                    flex items-center justify-center text-sm font-medium capitalize
                                    transition-colors">
                      {r}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full">
              Log Waste
            </button>
          </form>
        </div>
      )}

      {/* Recent waste */}
      {(recent ?? []).length > 0 && (
        <div>
          <p className="section-title">Recent</p>
          <div className="space-y-2">
            {recent!.map((w: WasteEntry & { product: { name: string } }) => (
              <div key={w.id} className="card flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{w.product.name}</p>
                  <p className="text-[var(--text-muted)] capitalize">{w.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-status-red">−{formatPrice(w.total_cost)}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(w.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
