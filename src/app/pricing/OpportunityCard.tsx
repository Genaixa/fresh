'use client'

import { useState, useCallback } from 'react'
import { setOpportunityPrice } from './actions'
import { formatPrice } from '@/lib/pricing-engine'

interface Props {
  productId: string
  productName: string
  currentRetailPrice: number  // pence
  costPence: number
  marginFloor: number         // 0–1
  weeklyUnits: number | null
}

const TARGET_MARGIN = 0.33

function calcMargin(price: number, cost: number) {
  if (price <= 0) return 0
  return (price - cost) / price
}

function calcPrice(margin: number, cost: number) {
  if (margin >= 1) return 0
  return Math.round(cost / (1 - margin))
}

// Nearest "clean" price point: round up to next 5p
function cleanPrice(pence: number) {
  return Math.ceil(pence / 5) * 5
}

export function OpportunityCard({ productId, productName, currentRetailPrice, costPence, marginFloor, weeklyUnits }: Props) {
  const suggestedRaw = calcPrice(TARGET_MARGIN, costPence)
  const suggested    = cleanPrice(suggestedRaw)

  const [pricePounds, setPricePounds] = useState((suggested / 100).toFixed(2))
  const [marginPct,   setMarginPct]   = useState((calcMargin(suggested, costPence) * 100).toFixed(1))
  const [pending,     setPending]     = useState(false)
  const [done,        setDone]        = useState(false)

  const currentMarginPct = (calcMargin(currentRetailPrice, costPence) * 100).toFixed(1)

  const onPriceChange = useCallback((val: string) => {
    setPricePounds(val)
    const p = Math.round(parseFloat(val) * 100)
    if (!isNaN(p) && p > 0) setMarginPct((calcMargin(p, costPence) * 100).toFixed(1))
  }, [costPence])

  const onMarginChange = useCallback((val: string) => {
    setMarginPct(val)
    const f = parseFloat(val) / 100
    if (!isNaN(f) && f < 1 && f >= 0) setPricePounds((calcPrice(f, costPence) / 100).toFixed(2))
  }, [costPence])

  const livePricePence    = Math.round(parseFloat(pricePounds) * 100) || 0
  const liveMarginFraction = parseFloat(marginPct) / 100
  const belowFloor        = liveMarginFraction < marginFloor

  const extraPencePerUnit = livePricePence - currentRetailPrice
  const weeklyGain = weeklyUnits && weeklyUnits > 0 ? extraPencePerUnit * weeklyUnits : null

  async function handleApply() {
    if (livePricePence <= costPence) return
    setPending(true)
    await setOpportunityPrice(productId, livePricePence)
    setDone(true)
  }

  if (done) return null

  return (
    <div className={`card border border-status-green/20 ${pending ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-status-green font-bold">↑</span>
            <p className="font-medium">{productName}</p>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            now {formatPrice(currentRetailPrice)} · {currentMarginPct}% margin · cost {formatPrice(costPence)}
          </p>
          {weeklyGain !== null && weeklyGain > 0 && (
            <p className="text-xs text-status-green/80 mt-0.5">
              +{formatPrice(weeklyGain)}/wk at this price ({weeklyUnits} units)
            </p>
          )}
        </div>
        <button
          onClick={handleApply}
          disabled={livePricePence <= costPence || belowFloor}
          className="min-h-[44px] px-4 rounded-xl bg-status-green/20 text-status-green text-sm font-semibold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
        >
          Apply
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-[var(--text-muted)] mb-1">Price</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">£</span>
            <input
              type="number" step="0.01" min="0.01"
              value={pricePounds}
              onChange={e => onPriceChange(e.target.value)}
              className="input-field pl-7 py-2.5 text-base font-semibold w-full"
            />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-[var(--text-muted)] mb-1">Margin</p>
          <div className="relative">
            <input
              type="number" step="0.1" min="0" max="99"
              value={marginPct}
              onChange={e => onMarginChange(e.target.value)}
              className={`input-field pr-8 py-2.5 text-base font-semibold w-full ${belowFloor ? 'text-status-amber' : 'text-status-green'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-[var(--text-muted)] flex justify-between">
        <span>target 33% · at cost: {formatPrice(costPence)}</span>
        {belowFloor && <span className="text-status-amber">⚠ below floor</span>}
      </div>
    </div>
  )
}
