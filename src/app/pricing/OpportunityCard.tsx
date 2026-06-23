'use client'

import { useState, useCallback } from 'react'
import { setOpportunityPrice, dismissOpportunity } from './actions'
import { formatPrice } from '@/lib/pricing-engine'

interface Props {
  productId: string
  productName: string
  currentRetailPrice: number
  costPence: number
  marginFloor: number
  weeklyUnits: number | null
  onRemove: (id: string) => void
  onPriceChange: (id: string, pricePence: number) => void
}

const TARGET_MARGIN = 0.40

function calcMargin(price: number, cost: number) {
  if (price <= 0) return 0
  return (price - cost) / price
}
function calcPrice(margin: number, cost: number) {
  if (margin >= 1) return 0
  return Math.round(cost / (1 - margin))
}
function cleanPrice(p: number) { return Math.ceil(p / 5) * 5 }

export function OpportunityCard({
  productId, productName, currentRetailPrice, costPence, marginFloor, weeklyUnits,
  onRemove, onPriceChange,
}: Props) {
  const suggested = cleanPrice(calcPrice(TARGET_MARGIN, costPence))

  const [pricePounds, setPricePounds] = useState((suggested / 100).toFixed(2))
  const [marginPct,   setMarginPct]   = useState((calcMargin(suggested, costPence) * 100).toFixed(1))
  const [pending,     setPending]     = useState(false)

  const currentMarginPct = (calcMargin(currentRetailPrice, costPence) * 100).toFixed(1)

  const livePricePence    = Math.round(parseFloat(pricePounds) * 100) || 0
  const liveMarginFraction = parseFloat(marginPct) / 100
  const belowFloor        = liveMarginFraction < marginFloor

  const weeklyGain = weeklyUnits && weeklyUnits > 0 ? (livePricePence - currentRetailPrice) * weeklyUnits : null

  const onPriceInput = useCallback((val: string) => {
    setPricePounds(val)
    const p = Math.round(parseFloat(val) * 100)
    if (!isNaN(p) && p > 0) {
      setMarginPct((calcMargin(p, costPence) * 100).toFixed(1))
      onPriceChange(productId, p)
    }
  }, [costPence, productId, onPriceChange])

  const onMarginInput = useCallback((val: string) => {
    setMarginPct(val)
    const f = parseFloat(val) / 100
    if (!isNaN(f) && f < 1 && f >= 0) {
      const p = calcPrice(f, costPence)
      setPricePounds((p / 100).toFixed(2))
      onPriceChange(productId, p)
    }
  }, [costPence, productId, onPriceChange])

  async function handleApply() {
    if (livePricePence <= costPence) return
    setPending(true)
    await setOpportunityPrice(productId, livePricePence)
    onRemove(productId)
  }

  async function handleDismiss() {
    setPending(true)
    await dismissOpportunity(productId)
    onRemove(productId)
  }

  return (
    <div className={`card border border-[var(--border)] ${pending ? 'opacity-40 pointer-events-none' : ''}`}>

      {/* Product name + cost */}
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-semibold">{productName}</p>
        <p className="text-xs text-[var(--text-muted)]">cost {formatPrice(costPence)}</p>
      </div>

      {/* Now vs At 40% */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-black/5 p-3">
          <p className="text-xs text-[var(--text-muted)] mb-1">Now</p>
          <p className="text-lg font-bold">{formatPrice(currentRetailPrice)}</p>
          <p className="text-xs text-[var(--text-muted)]">{currentMarginPct}% margin</p>
        </div>
        <div className="rounded-xl bg-status-green/10 p-3">
          <p className="text-xs text-status-green/80 mb-1">At 40%</p>
          <p className={`text-lg font-bold ${belowFloor ? 'text-status-amber' : 'text-status-green'}`}>
            {formatPrice(livePricePence)}
          </p>
          <p className={`text-xs ${belowFloor ? 'text-status-amber' : 'text-status-green/80'}`}>
            {marginPct}% margin{belowFloor ? ' ⚠' : ''}
          </p>
        </div>
      </div>

      {/* Weekly gain */}
      {weeklyGain !== null && weeklyGain > 0 && (
        <p className="text-sm text-status-green mb-3">
          +{formatPrice(weeklyGain)}/week extra &nbsp;
          <span className="text-xs text-[var(--text-muted)]">({weeklyUnits} units/wk)</span>
        </p>
      )}

      {/* Price / Margin editors */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">£</span>
          <input
            type="number" step="0.01" min="0.01"
            value={pricePounds}
            onChange={e => onPriceInput(e.target.value)}
            className="input-field pl-7 py-2.5 text-base font-semibold w-full"
          />
        </div>
        <div className="flex-1 relative">
          <input
            type="number" step="0.1" min="0" max="99"
            value={marginPct}
            onChange={e => onMarginInput(e.target.value)}
            className={`input-field pr-8 py-2.5 text-base font-semibold w-full ${belowFloor ? 'text-status-amber' : 'text-status-green'}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDismiss}
          className="flex-1 py-2.5 rounded-xl bg-black/5 text-[var(--text-muted)] text-sm font-medium active:bg-black/5 transition-colors"
        >
          Leave as is
        </button>
        <button
          onClick={handleApply}
          disabled={livePricePence <= costPence || belowFloor}
          className="flex-1 py-2.5 rounded-xl bg-status-green/20 text-status-green text-sm font-semibold active:bg-status-green/30 transition-colors disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
