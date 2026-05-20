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
}

interface RowState {
  product: Product
  newPrice: number
}

// ─── Per-row component with independent focus tracking ───────────────────────

function BulkRow({
  product,
  newPrice,
  onChange,
}: {
  product: Product
  newPrice: number
  onChange: (price: number) => void
}) {
  const [priceStr, setPriceStr] = useState(String(newPrice || ''))
  const [marginStr, setMarginStr] = useState('')
  const [priceFocused, setPriceFocused] = useState(false)
  const [marginFocused, setMarginFocused] = useState(false)

  const computedMargin =
    newPrice > 0 && product.purchase_cost > 0
      ? ((newPrice - product.purchase_cost) / newPrice) * 100
      : null

  // Sync from parent (nudge-all / reset) when not editing
  useEffect(() => {
    if (!priceFocused) setPriceStr(newPrice > 0 ? String(newPrice) : '')
    if (!marginFocused) setMarginStr(computedMargin != null ? computedMargin.toFixed(1) : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPrice, priceFocused, marginFocused])

  const changed = newPrice !== product.retail_price && newPrice > 0
  const priceDelta = changed ? newPrice - product.retail_price : 0

  let marginColour = 'text-[var(--text-muted)]'
  if (computedMargin != null) {
    const m = computedMargin / 100
    if (m >= product.margin_floor) marginColour = 'text-status-green'
    else if (m >= product.margin_floor * 0.8) marginColour = 'text-status-amber'
    else marginColour = 'text-status-red'
  }

  return (
    <div className={`grid grid-cols-[1fr_40px_58px_58px_36px] gap-x-1.5 items-center
                     rounded-xl px-2.5 py-2 min-h-[52px]
                     ${changed ? 'bg-brand-accent/10 border border-brand-accent/30' : 'bg-[var(--bg-card)]'}`}>
      {/* Name + cost */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{product.name}</p>
        <p className="text-xs text-[var(--text-muted)]">{formatPrice(product.purchase_cost)}</p>
      </div>

      {/* Delta */}
      <p className={`text-xs font-semibold text-right leading-none ${
        priceDelta > 0 ? 'text-status-green' : priceDelta < 0 ? 'text-status-red' : 'text-transparent'
      }`}>
        {priceDelta !== 0 ? `${priceDelta > 0 ? '+' : ''}${priceDelta}p` : '·'}
      </p>

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
          if (!marginFocused) {
            const m = p > 0 && product.purchase_cost > 0
              ? ((p - product.purchase_cost) / p * 100).toFixed(1) : ''
            setMarginStr(m)
          }
        }}
        onBlur={() => setPriceFocused(false)}
        className="w-full rounded-lg bg-white/10 border border-white/10 px-1.5 py-1.5
                   text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-accent"
      />

      {/* Margin input */}
      <input
        type="text" inputMode="decimal"
        value={marginStr}
        placeholder="%"
        onFocus={() => setMarginFocused(true)}
        onChange={e => {
          const s = e.target.value.replace(/[^0-9.]/g, '')
          setMarginStr(s)
          const m = parseFloat(s)
          if (m > 0 && m < 100 && product.purchase_cost > 0) {
            const p = Math.round(product.purchase_cost / (1 - m / 100))
            const capped = product.market_ceiling ? Math.min(p, product.market_ceiling) : p
            onChange(capped)
            if (!priceFocused) setPriceStr(String(capped))
          }
        }}
        onBlur={() => setMarginFocused(false)}
        className={`w-full rounded-lg bg-white/10 border border-white/10 px-1.5 py-1.5
                    text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-accent
                    ${marginColour}`}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkMarginPage() {
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyUnits, setWeeklyUnits] = useState(50)
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })

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

  function setMarginAll(targetMargin: number) {
    setRows(prev => prev.map(r => {
      if (r.product.purchase_cost <= 0) return r
      const p = Math.round(r.product.purchase_cost / (1 - targetMargin))
      const capped = r.product.market_ceiling ? Math.min(p, r.product.market_ceiling) : p
      return { ...r, newPrice: capped }
    }))
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

    const totalPriceDelta = rows.reduce((s, r) => s + (r.newPrice - r.product.retail_price), 0)

    const today = new Date()
    const end = new Date(endDate)
    const weeks = Math.max(0, Math.round((end.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    const weeklyExtra = totalPriceDelta * weeklyUnits
    const totalProjection = weeklyExtra * weeks

    return { currentBlended, newBlended, totalPriceDelta, weeklyExtra, totalProjection, weeks }
  }, [rows, weeklyUnits, endDate])

  const pricedRows = rows.filter(r => r.product.purchase_cost > 0)
  const unpricedRows = rows.filter(r => r.product.purchase_cost === 0)

  if (loading) {
    return (
      <div className="page pb-24 flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/margins"
          className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">Bulk Margin Planner</h1>
      </div>

      {summary && (
        <>
          {/* Blended margin summary */}
          <div className="card mb-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Current</p>
              <p className="font-bold text-lg">{formatMargin(summary.currentBlended)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">New</p>
              <p className={`font-bold text-lg ${
                summary.newBlended >= 0.20 ? 'text-status-green' :
                summary.newBlended >= 0.15 ? 'text-status-amber' : 'text-status-red'
              }`}>{formatMargin(summary.newBlended)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Δ blended</p>
              <p className={`font-bold text-lg ${
                summary.newBlended >= summary.currentBlended ? 'text-status-green' : 'text-status-red'
              }`}>
                {summary.newBlended >= summary.currentBlended ? '+' : ''}
                {formatMargin(summary.newBlended - summary.currentBlended)}
              </p>
            </div>
          </div>

          {/* Projection card */}
          <div className="card mb-3 space-y-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Revenue projection
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">
                  Avg weekly units / product
                </label>
                <input
                  type="text" inputMode="numeric"
                  value={weeklyUnits || ''}
                  onChange={e => setWeeklyUnits(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  className="input-field py-2 text-sm"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Project to</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="input-field py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-white/10">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Per week</p>
                <p className={`font-bold ${summary.weeklyExtra >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                  {summary.weeklyExtra >= 0 ? '+' : ''}{formatPrice(summary.weeklyExtra)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Weeks</p>
                <p className="font-bold">{summary.weeks}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total</p>
                <p className={`font-bold text-lg ${summary.totalProjection >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                  {summary.totalProjection >= 0 ? '+' : ''}{formatPrice(summary.totalProjection)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

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
        <p className="text-xs text-[var(--text-muted)] mb-2">Set all to target margin</p>
        <div className="flex gap-2">
          {[25, 30, 35, 40, 50].map(pct => (
            <button key={pct} onClick={() => setMarginAll(pct / 100)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold min-h-[44px] bg-brand-accent/20 text-brand-accent">
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_40px_58px_58px_36px] gap-x-1.5 px-2.5 mb-1">
        <p className="text-xs text-[var(--text-muted)]">Product / cost</p>
        <p className="text-xs text-[var(--text-muted)] text-right">Δ</p>
        <p className="text-xs text-[var(--text-muted)] text-center">Price p</p>
        <p className="text-xs text-[var(--text-muted)] text-center">Margin</p>
        <p className="text-xs text-transparent">·</p>
      </div>

      <div className="space-y-1">
        {pricedRows.map(({ product, newPrice }) => (
          <BulkRow
            key={product.id}
            product={product}
            newPrice={newPrice}
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
                className="grid grid-cols-[1fr_40px_58px_58px_36px] gap-x-1.5 items-center
                            rounded-xl px-2.5 py-2 min-h-[48px] bg-[var(--bg-card)]">
                <p className="text-sm truncate">{product.name}</p>
                <p className="text-xs text-right text-[var(--text-muted)]">—</p>
                <p className="text-xs text-center text-[var(--text-muted)]">—</p>
                <p className="text-xs text-center text-[var(--text-muted)]">—</p>
                <p />
              </div>
            ))}
          </div>
        </>
      )}

      <NavBar />
    </div>
  )
}
