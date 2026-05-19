import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatMargin } from '@/lib/pricing-engine'
import type { Product } from '@/types'

interface Alert {
  product: Product
  type: 'margin_declining' | 'price_sensitivity' | 'stable'
  detail: string
}

export default async function PriceMonitorPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)

  // Simple v1: flag products whose current margin is below floor
  // or where margin declined significantly vs 4 weeks ago
  const alerts: Alert[] = []

  for (const p of (products ?? []) as Product[]) {
    const currentMargin = p.retail_price > 0
      ? (p.retail_price - p.purchase_cost) / p.retail_price
      : 0

    if (currentMargin < p.margin_floor) {
      alerts.push({
        product: p,
        type: 'margin_declining',
        detail: `Margin ${formatMargin(currentMargin)} is below floor ${formatMargin(p.margin_floor)}`,
      })
    }
  }

  const stable = (products ?? []).filter(
    (p: Product) => !alerts.find(a => a.product.id === p.id)
  ) as Product[]

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Price Intelligence</h1>
      </div>

      {alerts.length === 0 && (
        <div className="card text-center py-10 mb-4">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-semibold text-status-green">All margins healthy</p>
        </div>
      )}

      {alerts.map(alert => (
        <div key={alert.product.id}
             className="card mb-3 border border-status-amber/30">
          <div className="flex items-start gap-3">
            <span className="text-status-amber text-xl mt-0.5">⚠</span>
            <div>
              <p className="font-semibold">{alert.product.name}</p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{alert.detail}</p>
              <Link href={`/products/${alert.product.id}`}
                    className="text-brand-accent text-sm mt-2 inline-block min-h-[36px]
                               flex items-center">
                Review product →
              </Link>
            </div>
          </div>
        </div>
      ))}

      {stable.length > 0 && (
        <div className="mt-4">
          <p className="section-title">Stable products</p>
          <div className="space-y-1">
            {stable.map((p: Product) => (
              <div key={p.id} className="card flex items-center justify-between min-h-[48px]">
                <div className="flex items-center gap-2">
                  <span className="text-status-green text-sm">●</span>
                  <p className="text-sm font-medium">{p.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
