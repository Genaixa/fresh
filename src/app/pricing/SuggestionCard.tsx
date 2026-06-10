'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { amendAndApproveSuggestion, approveWithheldAnyway, rejectSuggestion, holdSuggestion, unholdSuggestion } from './actions'
import { formatPrice } from '@/lib/pricing-engine'

interface Props {
  id: string
  productName: string
  currentRetailPrice: number  // pence
  suggestedRetailPrice: number  // pence
  costPence: number  // pence — weighted avg or purchase_cost
  marginWarning: boolean
  marginFloor: number  // 0–1
  isHeld?: boolean
  isWithheld?: boolean      // withheld by the plausibility filter — needs review
  blockReason?: string | null
  invoiceId: string | null
  invoiceDate: string | null
  supplierName: string | null
}

function calcMargin(pricePence: number, costPence: number): number {
  if (pricePence <= 0) return 0
  return (pricePence - costPence) / pricePence
}

function calcPrice(marginFraction: number, costPence: number): number {
  if (marginFraction >= 1) return 0
  return Math.round(costPence / (1 - marginFraction))
}

export function SuggestionCard({
  id,
  productName,
  currentRetailPrice,
  suggestedRetailPrice,
  costPence,
  marginWarning,
  marginFloor,
  isHeld = false,
  isWithheld = false,
  blockReason = null,
  invoiceId,
  invoiceDate,
  supplierName,
}: Props) {
  // Withheld cards pre-fill the current (sane) price, not the blocked suggestion —
  // so the safe default if David just taps ✓ is to keep the existing price.
  const initialPence = isWithheld && currentRetailPrice > 0 ? currentRetailPrice : suggestedRetailPrice
  const [pricePounds, setPricePounds] = useState((initialPence / 100).toFixed(2))
  const [marginPct, setMarginPct] = useState(
    (calcMargin(initialPence, costPence) * 100).toFixed(1)
  )
  const [pending, setPending] = useState(false)

  const currentMargin = calcMargin(currentRetailPrice, costPence)

  const onPriceChange = useCallback((val: string) => {
    setPricePounds(val)
    const pence = Math.round(parseFloat(val) * 100)
    if (!isNaN(pence) && pence > 0) {
      setMarginPct((calcMargin(pence, costPence) * 100).toFixed(1))
    }
  }, [costPence])

  const onMarginChange = useCallback((val: string) => {
    setMarginPct(val)
    const fraction = parseFloat(val) / 100
    if (!isNaN(fraction) && fraction < 1 && fraction >= 0) {
      setPricePounds((calcPrice(fraction, costPence) / 100).toFixed(2))
    }
  }, [costPence])

  const livePricePence = Math.round(parseFloat(pricePounds) * 100) || 0
  const liveMarginFraction = parseFloat(marginPct) / 100
  const belowFloor = liveMarginFraction < marginFloor

  const delta = suggestedRetailPrice - currentRetailPrice
  const direction = delta > 0 ? '▲' : delta < 0 ? '▼' : '●'
  const dirColour = delta > 0 ? 'text-status-green' : delta < 0 ? 'text-status-red' : 'text-gray-400'

  async function handleApprove() {
    setPending(true)
    if (isWithheld) {
      // Withheld card: the price was blocked as implausible. Whatever David sets,
      // route it through the explicit override so the retail guard lets it through.
      await approveWithheldAnyway(id, livePricePence)
    } else {
      const fd = new FormData()
      fd.append('price_pounds', pricePounds)
      await amendAndApproveSuggestion(id, fd)
    }
  }

  async function handleReject() {
    setPending(true)
    await rejectSuggestion(id)
  }

  async function handleHold() {
    setPending(true)
    await holdSuggestion(id)
    setPending(false)
  }

  async function handleUnhold() {
    setPending(true)
    await unholdSuggestion(id)
    setPending(false)
  }

  return (
    <div className={`card border ${
      isWithheld ? 'border-status-red/50' :
      isHeld ? 'border-status-amber/40 opacity-60' :
      marginWarning ? 'border-status-amber/40' : 'border-white/5'
    } ${pending ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Withheld banner — why this price was blocked */}
      {isWithheld && blockReason && (
        <div className="mb-3 rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2">
          <p className="text-xs font-semibold text-status-red mb-0.5">🚫 Withheld — looks wrong</p>
          <p className="text-xs text-[var(--text-muted)] leading-snug">{blockReason}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">
            Set the correct price and tap ✓ to apply, or ✗ to discard.
          </p>
        </div>
      )}
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-lg ${isHeld ? 'text-status-amber' : dirColour}`}>
            {isHeld ? '⏸' : direction}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{productName}</p>
              {isHeld && (
                <span className="text-xs bg-status-amber/15 text-status-amber px-1.5 py-0.5 rounded-md">
                  held
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              was {formatPrice(currentRetailPrice)}
              {' · '}cost {formatPrice(costPence)}
              {' · '}floor {Math.round(marginFloor * 100)}%
            </p>
            {invoiceId && invoiceDate && (
              <Link
                href={`/invoices/${invoiceId}/review`}
                className="inline-flex items-center gap-1 text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[var(--text-muted)] active:bg-white/10 mt-0.5"
              >
                📄 {supplierName} · {new Date(invoiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isHeld ? (
            <button
              onClick={handleUnhold}
              className="min-h-[44px] px-3 rounded-xl bg-status-amber/20 text-status-amber text-xs font-semibold flex items-center justify-center active:scale-95 transition-transform"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={handleHold}
              className="min-h-[44px] px-3 rounded-xl bg-white/5 text-[var(--text-muted)] text-xs font-semibold flex items-center justify-center active:scale-95 transition-transform"
            >
              Hold
            </button>
          )}
          <button
            onClick={handleApprove}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-status-green/20 text-status-green font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ✓
          </button>
          <button
            onClick={handleReject}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-status-red/20 text-status-red font-bold text-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ✗
          </button>
        </div>
      </div>

      {/* Price + Margin editors */}
      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-[var(--text-muted)] mb-1">Price</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">£</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
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
              type="number"
              step="0.1"
              min="0"
              max="99"
              value={marginPct}
              onChange={e => onMarginChange(e.target.value)}
              className={`input-field pr-8 py-2.5 text-base font-semibold w-full ${
                belowFloor ? 'text-status-amber' : 'text-status-green'
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">%</span>
          </div>
        </div>
      </div>

      {/* Live feedback */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">
          current margin: {(currentMargin * 100).toFixed(1)}%
        </span>
        {belowFloor && (
          <span className="text-status-amber font-medium">⚠ below floor</span>
        )}
        {livePricePence > 0 && livePricePence !== suggestedRetailPrice && (
          <span className="text-[var(--text-muted)]">
            suggested was {formatPrice(suggestedRetailPrice)}
          </span>
        )}
      </div>
    </div>
  )
}
