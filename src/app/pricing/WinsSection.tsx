'use client'

import { useState } from 'react'
import { OpportunityCard } from './OpportunityCard'
import { formatPrice } from '@/lib/pricing-engine'
import { InfoTip } from '@/components/ui/InfoTip'

interface Opp {
  id: string
  name: string
  retail_price: number
  purchase_cost: number
  margin_floor: number
  weekly_units: number | null
}

const TARGET_MARGIN = 0.40

function suggestedPrice(cost: number) {
  return Math.ceil(Math.round(cost / (1 - TARGET_MARGIN)) / 5) * 5
}

export function WinsSection({ opportunities, description }: { opportunities: Opp[]; description: string }) {
  const [visible,    setVisible]    = useState(() => new Set(opportunities.map(o => o.id)))
  const [livePrices, setLivePrices] = useState<Record<string, number>>(
    () => Object.fromEntries(opportunities.map(o => [o.id, suggestedPrice(o.purchase_cost)]))
  )

  const shown = opportunities.filter(o => visible.has(o.id))

  // Running total — only products with known weekly volume
  const { totalGain, coveredCount } = shown.reduce(
    (acc, o) => {
      if (!o.weekly_units || o.weekly_units <= 0) return acc
      const live = livePrices[o.id] ?? o.retail_price
      return { totalGain: acc.totalGain + (live - o.retail_price) * o.weekly_units, coveredCount: acc.coveredCount + 1 }
    },
    { totalGain: 0, coveredCount: 0 }
  )

  function handleRemove(id: string) {
    setVisible(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  function handlePriceChange(id: string, pricePence: number) {
    setLivePrices(prev => ({ ...prev, [id]: pricePence }))
  }

  if (shown.length === 0) return (
    <p className="text-sm text-[var(--text-muted)] text-center py-8">All opportunities reviewed — check back after the next delivery.</p>
  )

  return (
    <>
      <p className="text-xs text-[var(--text-muted)] mb-3">{description}</p>

      {coveredCount > 0 && (
        <div className="card border border-status-green/30 bg-status-green/5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">
                Per week<InfoTip text="Extra revenue per week if you raise all these products to the suggested price." />
              </p>
              <p className="text-xl font-bold text-status-green">+{formatPrice(totalGain)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">
                Per year<InfoTip text="Weekly gain × 52. Assumes current sales volumes and all prices applied." />
              </p>
              <p className="text-xl font-bold text-status-green">+{formatPrice(totalGain * 52)}</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            if all applied · {coveredCount} of {shown.length} products have weekly volume data<InfoTip text="Products without weekly sales data are excluded from the gain estimate." />
          </p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map(o => (
          <OpportunityCard
            key={o.id}
            productId={o.id}
            productName={o.name}
            currentRetailPrice={o.retail_price}
            costPence={o.purchase_cost}
            marginFloor={o.margin_floor}
            weeklyUnits={o.weekly_units}
            onRemove={handleRemove}
            onPriceChange={handlePriceChange}
          />
        ))}
      </div>
    </>
  )
}
