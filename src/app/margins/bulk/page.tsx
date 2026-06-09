'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'

interface Product {
  id: string
  name: string
  purchase_cost: number
  retail_price: number
  margin_floor: number
  market_ceiling: number | null
  weekly_units: number | null
}

interface RowState {
  product: Product
  newPrice: number
}

function BulkRow({
  product,
  newPrice,
  fallbackUnits,
  onChange,
}: {
  product: Product
  newPrice: number
  fallbackUnits: number
  onChange: (price: number) => void
}) {
  const [priceStr, setPriceStr] = useState(String(newPrice || ''))
  const [markupStr, setMarkupStr] = useState('')
  const [priceFocused, setPriceFocused] = useState(false)
  const [markupFocused, setMarkupFocused] = useState(false)

  const computedMarkup =
    newPrice > 0 && product.purchase_cost > 0
      ? ((newPrice - product.purchase_cost) / product.purchase_cost) * 100
      : null

  const computedGM =
    newPrice > 0 && product.purchase_cost > 0
      ? (newPrice - product.purchase_cost) / newPrice
      : null

  useEffect(() => {
    if (!priceFocused) setPriceStr(newPrice > 0 ? String(newPrice) : '')
    if (!markupFocused) setMarkupStr(computedMarkup != null ? computedMarkup.toFixed(0) : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPrice, priceFocused, markupFocused])

  const changed = newPrice !== product.retail_price && newPrice > 0
  const priceDelta = changed ? newPrice - product.retail_price : 0
  const units = product.weekly_units ?? fallbackUnits
  const weeklyImpactPence = priceDelta * units
  const hasRealData = product.weekly_units != null

  let markupColour = 'text-[var(--text-muted)]'
  if (computedGM != null) {
    if (computedGM >= product.margin_floor) markupColour = 'text-status-green'
    else if (computedGM >= product.margin_floor * 0.8) markupColour = 'text-status-amber'
    else markupColour = 'text-status-red'
  }

  return (
    <div className={`rounded-xl px-2.5 py-2 min-h-[52px]
                     ${changed ? 'bg-brand-accent/10 border border-brand-accent/30' : 'bg-[var(--bg-card)]'}`}>
      <div className="grid grid-cols-[1fr_58px_58px] gap-x-1.5 items-center">
        {/* Name + cost */}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate leading-tight">{product.name}</p>
          <p className="text-xs text-[var(--text-muted)]">cost {formatPrice(product.purchase_cost)}</p>
        </div>

        {/* Price input */}
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={priceStr}
          placeholder="p"
          onFocus={() => setPriceFocused(true)}
          onChange={e => {
            const s = e.target.value.replace(/[^0-9]/g, '')
            setPriceStr(s)
            const p = parseInt(s) || 0
            onChange(p)
            if (!markupFocused) {
              const mu = p > 0 && product.purchase_cost > 0
                ? ((p - product.purchase_cost) / product.purchase_cost * 100).toFixed(0) : ''
              setMarkupStr(mu)
            }
          }}
          onBlur={() => setPriceFocused(false)}
          className="w-full rounded-lg bg-white/10 border border-white/10 px-1.5 py-1.5
                     text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-accent"
        />

        {/* Markup input */}
        <input
          type="text" inputMode="numeric"
          value={markupStr}
          placeholder="%"
          onFocus={() => setMarkupFocused(true)}
          onChange={e => {
            const s = e.target.value.replace(/[^0-9]/g, '')
            setMarkupStr(s)
            const mu = parseInt(s)
            if (mu > 0 && product.purchase_cost > 0) {
              const p = Math.round(product.purchase_cost * (1 + mu / 100))
              const capped = product.market_ceiling ? Math.min(p, product.market_ceiling) : p
              onChange(capped)
              if (!priceFocused) setPriceStr(String(capped))
            }
          }}
          onBlur={() => setMarkupFocused(false)}
          className={`w-full rounded-lg bg-white/10 border border-white/10 px-1.5 py-1.5
                      text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-accent
                      ${markupColour}`}
        />
      </div>

      {/* Impact row — only shown when changed */}
      {changed && (
        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
          <span className={`font-semibold ${priceDelta > 0 ? 'text-status-green' : 'text-status-red'}`}>
            {priceDelta > 0 ? '+' : ''}{priceDelta}p/unit
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-muted)]">{units}/wk</span>
          {hasRealData
            ? <span className="text-brand-accent opacity-70">real</span>
            : <span className="text-[var(--text-muted)] opacity-60">est</span>}
          <span className="text-[var(--text-muted)]">·</span>
          <span className={`font-semibold ${weeklyImpactPence > 0 ? 'text-status-green' : 'text-status-red'}`}>
            {weeklyImpactPence > 0 ? '+' : ''}{formatPrice(weeklyImpactPence)}/wk
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className={`${weeklyImpactPence > 0 ? 'text-status-green' : 'text-status-red'} opacity-70`}>
            {weeklyImpactPence > 0 ? '+' : ''}{formatPrice(weeklyImpactPence * 52)}/yr
          </span>
        </div>
      )}
    </div>
  )
}

export default function BulkMarginPage() {
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [weeklyUnits, setWeeklyUnits] = useState(50)

  useEffect(() => {
    fetch('/api/products/simple-list')
      .then(r => r.json())
      .then(d => {
        setRows((d.products ?? []).map((p: Product) => ({ product: p, newPrice: p.retail_price })))
        setLoading(false)
      })
  }, [])

  function updatePrice(id: string, price: number) {
    setRows(prev => prev.map(r => r.product.id === id ? { ...r, newPrice: price } : r))
  }

  function nudgeAll(delta: number) {
    setRows(prev => prev.map(r => ({
      ...r,
      newPrice: r.product.purchase_cost > 0 ? Math.max(r.product.purchase_cost + 1, r.newPrice + delta) : r.newPrice,
    })))
  }

  function resetAll() {
    setRows(prev => prev.map(r => ({ ...r, newPrice: r.product.retail_price })))
  }

  function setMarkupAll(targetMarkup: number) {
    setRows(prev => prev.map(r => {
      if (r.product.purchase_cost <= 0) return r
      const p = Math.round(r.product.purchase_cost * (1 + targetMarkup / 100))
      const capped = r.product.market_ceiling ? Math.min(p, r.product.market_ceiling) : p
      return { ...r, newPrice: capped }
    }))
  }

  async function saveChanges() {
    const changed = rows.filter(r => r.newPrice > 0 && r.newPrice !== r.product.retail_price)
    if (!changed.length) return
    setSaving(true)
    setSavedCount(null)
    await Promise.all(
      changed.map(r =>
        fetch(`/api/products/${r.product.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ retail_price: r.newPrice }),
        })
      )
    )
    setRows(prev => prev.map(r => ({
      ...r,
      product: { ...r.product, retail_price: r.newPrice > 0 ? r.newPrice : r.product.retail_price },
    })))
    setSaving(false)
    setSavedCount(changed.length)
    setTimeout(() => setSavedCount(null), 3000)
  }

  const summary = useMemo(() => {
    const priced = rows.filter(r => r.product.purchase_cost > 0 && r.product.retail_price > 0)
    if (!priced.length) return null
    const currentBlended = priced.reduce((s, r) =>
      s + (r.product.retail_price - r.product.purchase_cost) / r.product.retail_price, 0
    ) / priced.length
    const newPriced = rows.filter(r => r.product.purchase_cost > 0 && r.newPrice > 0)
    const newBlended = newPriced.length
      ? newPriced.reduce((s, r) => s + (r.newPrice - r.product.purchase_cost) / r.newPrice, 0) / newPriced.length
      : 0
    const changedRows = rows.filter(r => r.newPrice > 0 && r.newPrice !== r.product.retail_price)
    const weeklyImpact = changedRows.reduce((s, r) => {
      const units = r.product.weekly_units ?? weeklyUnits
      return s + (r.newPrice - r.product.retail_price) * units
    }, 0)
    const realDataCount = rows.filter(r => r.product.weekly_units != null).length
    return { currentBlended, newBlended, weeklyImpact, changedCount: changedRows.length, realDataCount }
  }, [rows, weeklyUnits])

  const pricedRows   = rows.filter(r => r.product.purchase_cost > 0)
  const unpricedRows = rows.filter(r => r.product.purchase_cost === 0)
  const changedCount = rows.filter(r => r.newPrice > 0 && r.newPrice !== r.product.retail_price).length

  if (loading) {
    return (
      <div className="page pb-24 flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/margins"
          className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">Bulk Margin Planner</h1>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="card text-center py-2">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">Current GM</p>
            <p className="font-bold text-base leading-tight">{formatMargin(summary.currentBlended)}</p>
          </div>
          <div className="card text-center py-2">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">New GM</p>
            <p className={`font-bold text-base leading-tight ${
              summary.newBlended >= 0.20 ? 'text-status-green' :
              summary.newBlended >= 0.15 ? 'text-status-amber' : 'text-status-red'
            }`}>{formatMargin(summary.newBlended)}</p>
          </div>
          {summary.changedCount > 0 && (
            <div className="col-span-2 card py-2 flex items-center justify-between px-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">{summary.changedCount} products changed</p>
                <p className="text-xs text-[var(--text-muted)]">{summary.realDataCount} with real Epos data</p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${summary.weeklyImpact >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                  {summary.weeklyImpact >= 0 ? '+' : ''}{formatPrice(summary.weeklyImpact)}/wk
                </p>
                <p className={`text-xs ${summary.weeklyImpact >= 0 ? 'text-status-green' : 'text-status-red'} opacity-70`}>
                  {summary.weeklyImpact >= 0 ? '+' : ''}{formatPrice(summary.weeklyImpact * 52)}/yr
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly units assumption */}
      <div className="card mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Fallback units/wk</p>
          <p className="text-xs text-[var(--text-muted)]">used for products without Epos data</p>
        </div>
        <input
          type="text" inputMode="numeric"
          value={weeklyUnits || ''}
          onChange={e => setWeeklyUnits(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
          className="input-field py-2 text-sm w-20 text-center"
          placeholder="50"
        />
      </div>

      {/* Global nudge controls */}
      <div className="card mb-4">
        <p className="text-xs text-[var(--text-muted)] mb-2">Nudge all prices</p>
        <div className="flex gap-2 mb-3">
          {[-10, -5, +5, +10].map(d => (
            <button key={d} onClick={() => nudgeAll(d)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold min-h-[44px]
                ${d > 0 ? 'bg-brand-accent/20 text-brand-accent' : 'bg-white/10 text-[var(--text-muted)]'}`}>
              {d > 0 ? `+${d}p` : `${d}p`}
            </button>
          ))}
          <button onClick={resetAll}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold min-h-[44px] bg-white/5 text-[var(--text-muted)]">
            Reset
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-2">Set all markup to</p>
        <div className="flex gap-2">
          {[50, 75, 100, 150, 200].map(pct => (
            <button key={pct} onClick={() => setMarkupAll(pct)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold min-h-[44px] bg-brand-accent/20 text-brand-accent">
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={saveChanges}
        disabled={saving || changedCount === 0}
        className={`w-full rounded-xl py-3.5 text-sm font-bold min-h-[52px] mb-4 transition-colors
          ${savedCount !== null
            ? 'bg-status-green/20 text-status-green'
            : changedCount > 0
              ? 'bg-brand-accent text-white'
              : 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed'}`}
      >
        {saving
          ? 'Saving…'
          : savedCount !== null
            ? `✓ Saved ${savedCount} price${savedCount !== 1 ? 's' : ''}`
            : changedCount > 0
              ? `Save ${changedCount} price change${changedCount !== 1 ? 's' : ''}`
              : 'No changes'}
      </button>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_58px_58px] gap-x-1.5 px-2.5 mb-1">
        <p className="text-xs text-[var(--text-muted)]">Product</p>
        <p className="text-xs text-[var(--text-muted)] text-center">Sell p</p>
        <p className="text-xs text-[var(--text-muted)] text-center">Markup %</p>
      </div>

      <div className="space-y-1">
        {pricedRows.map(({ product, newPrice }) => (
          <BulkRow
            key={product.id}
            product={product}
            newPrice={newPrice}
            fallbackUnits={weeklyUnits}
            onChange={price => updatePrice(product.id, price)}
          />
        ))}
      </div>

      {unpricedRows.length > 0 && (
        <>
          <p className="section-title mt-6 mb-2 text-[var(--text-muted)]">
            No cost set — upload an invoice first ({unpricedRows.length})
          </p>
          <div className="space-y-1 opacity-35">
            {unpricedRows.map(({ product }) => (
              <div key={product.id}
                className="grid grid-cols-[1fr_58px_58px] gap-x-1.5 items-center
                            rounded-xl px-2.5 py-2 min-h-[48px] bg-[var(--bg-card)]">
                <p className="text-sm truncate">{product.name}</p>
                <p className="text-xs text-center text-[var(--text-muted)]">—</p>
                <p className="text-xs text-center text-[var(--text-muted)]">—</p>
              </div>
            ))}
          </div>
        </>
      )}

      <NavBar />
    </div>
  )
}
