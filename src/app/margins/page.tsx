import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { formatMargin, formatPrice } from '@/lib/pricing-engine'
import { marginStatus, TrafficDot } from '@/components/ui/TrafficDot'
import { MarginCharts } from '@/components/ui/MarginCharts'
import type { Product } from '@/types'

export default async function MarginsPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Waste cost this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: waste } = await supabase
    .from('waste_log')
    .select('total_cost')
    .gte('created_at', weekAgo)

  const totalWastePence = (waste ?? []).reduce(
    (sum: number, w: { total_cost: number }) => sum + w.total_cost, 0
  )

  // Per-product margins — only include products where we know both cost and retail
  const productMargins = (products ?? [])
    .filter((p: Product) => p.retail_price > 0 && p.purchase_cost > 0)
    .map((p: Product) => {
      const gross = (p.retail_price - p.purchase_cost) / p.retail_price
      return { product: p, margin: gross }
    })

  // Overall blended margin (simple average of products with known cost)
  const avgMargin = productMargins.length
    ? productMargins.reduce((sum: number, pm: { margin: number }) => sum + pm.margin, 0) /
      productMargins.length
    : 0

  const wasteImpact = totalWastePence > 0 ? -0.012 : 0  // simplified

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Margins</h1>
        <div className="flex gap-3">
          <Link href="/margins/bulk"
            className="text-brand-accent text-sm min-h-[44px] flex items-center">
            Bulk →
          </Link>
          <Link href="/margins/sim"
            className="text-brand-accent text-sm min-h-[44px] flex items-center">
            Sim →
          </Link>
        </div>
      </div>

      {/* Overall card */}
      <div className="card mb-6 text-center">
        <p className="text-xs text-[var(--text-muted)] mb-1">Overall margin (blended)</p>
        <p className={`text-5xl font-bold mb-1 ${
          avgMargin >= 0.20 ? 'text-status-green' :
          avgMargin >= 0.15 ? 'text-status-amber' : 'text-status-red'
        }`}>
          {formatMargin(avgMargin + wasteImpact)}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Target 20% · Waste impact: {formatMargin(wasteImpact)}
        </p>
      </div>

      {/* This week waste */}
      <div className="card mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Waste this week</p>
          <p className="text-xs text-[var(--text-muted)]">Cost of thrown / marked-down items</p>
        </div>
        <p className="text-xl font-bold text-status-red">
          −{formatPrice(totalWastePence)}
        </p>
      </div>

      {/* Charts */}
      <MarginCharts
        products={(products ?? []).map((p: Product) => ({
          name:          p.name,
          cost:          p.purchase_cost,
          price:         p.retail_price,
          originalPrice: p.retail_price,
          marginFloor:   p.margin_floor,
        }))}
      />

      {/* Per product */}
      <p className="section-title">By product</p>
      <div className="space-y-2">
        {productMargins
          .sort((a: { margin: number }, b: { margin: number }) => a.margin - b.margin)
          .map(({ product, margin }: { product: Product; margin: number }) => {
            const status = marginStatus(margin, product.margin_floor)
            return (
              <div key={product.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrafficDot status={status} />
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    {status !== 'green' && (
                      <p className="text-xs text-status-amber">
                        {product.market_ceiling ? 'ceiling limit' : 'check pricing'}
                      </p>
                    )}
                  </div>
                </div>
                <p className={`font-semibold ${
                  status === 'green' ? 'text-status-green' :
                  status === 'amber' ? 'text-status-amber' : 'text-status-red'
                }`}>
                  {formatMargin(margin)}
                </p>
              </div>
            )
          })}
      </div>

      <NavBar />
    </div>
  )
}
