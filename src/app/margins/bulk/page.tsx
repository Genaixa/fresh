'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'
import { MarginCharts } from '@/components/ui/MarginCharts'
import type { ChartProduct } from '@/components/ui/MarginCharts'

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
  const [markupStr, setMarkupStr] = useState('')
  const [priceFocused, setPriceFocused] = useState(false)
  const [markupFocused, setMarkupFocused] = useState(false)

  // Markup % = (price - cost) / cost × 100  — so 100 = double the cost
  const computedMarkup =
    newPrice > 0 && product.purchase_cost > 0
      ? ((newPrice - product.purchase_cost) / product.purchase_cost) * 100
      : null

  // Gross margin (for colour coding against margin_floor stored in DB)
  const computedGM =
    newPrice > 0 && product.purchase_cost > 0
      ? (newPrice - product.purchase_cost) / newPrice
      : null

  // Sync from parent (nudge-all / reset) when not editing
  useEffect(() => {
    if (!priceFocused) setPriceStr(newPrice > 0 ? String(newPrice) : '')
    if (!markupFocused) setMarkupStr(computedMarkup != null ? computedMarkup.toFixed(0) : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPrice, priceFocused, markupFocused])

  const changed = newPrice !== product.retail_price && newPrice > 0
  const priceDelta = changed ? newPrice - product.retail_price : 0

  let markupColour = 'text-[var(--text-muted)]'
  if (computedGM != null) {
    if (computedGM >= product.margin_floor) markupColour = 'text-status-green'
    else if (computedGM >= product.margin_floor * 0.8) markupColour = 'text-status-amber'
    else markupColour = 'text-status-red'
  }

  return (
    <div className={`grid grid-cols-[1fr_40px_58px_58px_36px] gap-x-1.5 items-center
                     rounded-xl px-2.5 py-2 min-h-[52px]
                     ${changed ? 'bg-brand-accent/10 border border-brand-accent/30' : 'bg-[var(--bg-card)]'}`}>
      {/* Name + cost */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{product.name}</p>
        <p className="text-xs text-[var(--text-muted)]">cost {formatPrice(product.purchase_cost)}</p>
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
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkMarginPage() {
  const [rows, setRows] = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyUnits, setWeeklyUnits] = useState(50)
  const [activeTab, setActiveTab] = useState<'overview' | 'edit'>('overview')
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

  function setMarkupAll(targetMarkup: number) {
    setRows(prev => prev.map(r => {
      if (r.product.purchase_cost <= 0) return r
      const p = Math.round(r.product.purchase_cost * (1 + targetMarkup / 100))
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

  const pricedRows  = rows.filter(r => r.product.purchase_cost > 0)
  const unpricedRows = rows.filter(r => r.product.purchase_cost === 0)

  const chartProducts: ChartProduct[] = rows.map(r => ({
    name:          r.product.name,
    cost:          r.product.purchase_cost,
    price:         r.newPrice,
    originalPrice: r.product.retail_price,
    marginFloor:   r.product.margin_floor,
  }))

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

      {/* Compact summary strip — always visible */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Current GM', val: formatMargin(summary.currentBlended), colour: '' },
            { label: 'New GM',     val: formatMargin(summary.newBlended),
              colour: summary.newBlended >= 0.20 ? 'text-status-green' : summary.newBlended >= 0.15 ? 'text-status-amber' : 'text-status-red' },
            { label: 'Δ / week',   val: `${summary.weeklyExtra >= 0 ? '+' : ''}${formatPrice(summary.weeklyExtra)}`,
              colour: summary.weeklyExtra >= 0 ? 'text-status-green' : 'text-status-red' },
          ].map(({ label, val, colour }) => (
            <div key={label} className="card text-center py-2">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
              <p className={`font-bold text-base leading-tight ${colour}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
        {(['overview', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold min-h-[40px] transition-colors
              ${activeTab === tab
                ? 'bg-brand-accent text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            {tab === 'overview' ? '📊 Overview' : '✏️ Edit prices'}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* Projection inputs */}
          <div className="card mb-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Projection settings
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
            {summary && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-center">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{summary.weeks} weeks total</p>
                </div>
                <div>
                  <p className={`font-bold text-sm ${summary.totalProjection >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                    {summary.totalProjection >= 0 ? '+' : ''}{formatPrice(summary.totalProjection)} projected
                  </p>
                </div>
              </div>
            )}
          </div>

          <MarginCharts
            products={chartProducts}
            weeklyUnits={weeklyUnits}
            endDate={endDate}
          />
        </>
      )}

      {/* ── Edit tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'edit' && (
        <>
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

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_40px_58px_58px_36px] gap-x-1.5 px-2.5 mb-1">
            <p className="text-xs text-[var(--text-muted)]">Product</p>
            <p className="text-xs text-[var(--text-muted)] text-right">Δ</p>
            <p className="text-xs text-[var(--text-muted)] text-center">Sell p</p>
            <p className="text-xs text-[var(--text-muted)] text-center">Markup</p>
            <p className="text-xs text-transparent">·</p>
          </div>
          <p className="text-xs text-[var(--text-muted)] px-2.5 mb-2">
            100% markup = sell at double cost. Switch to Overview to see charts update live.
          </p>

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
        </>
      )}

      <NavBar />
    </div>
  )
}
