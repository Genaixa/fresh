'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderProduct, OrderCustomer } from './page'
import { upsertOrder, confirmOrder } from '../actions'
import { suggestedWholesalePrice } from '@/lib/wholesale-pricing'

type LineItem = { qty: number; unitType: 'box' | 'retail_unit'; pricePence: number }

const fmt  = (p: number) => `£${(p / 100).toFixed(2)}`

// ── Pricing alert ─────────────────────────────────────────────────────────────

type Alert = { text: string; tone: 'loss' | 'warn' }

function getPricingAlert(
  pricePence:      number,
  unitType:        'box' | 'retail_unit',
  buyCostPence:    number | null,
  typicalBoxCount: number,
): Alert | null {
  if (!pricePence || !buyCostPence) return null

  // Normalise both to per-box for comparison
  const sellPerBox = unitType === 'box' ? pricePence : pricePence * typicalBoxCount
  const buyPerBox  = buyCostPence

  if (buyPerBox <= 0) return null

  const margin = (sellPerBox - buyPerBox) / sellPerBox

  if (margin < 0) {
    const loss = buyPerBox - sellPerBox
    return {
      text: `Losing ${fmt(loss)}/box — costs ${fmt(buyPerBox)}, charging ${fmt(sellPerBox)}`,
      tone: 'loss',
    }
  }
  if (margin < 0.20) {
    return {
      text: `${Math.round(margin * 100)}% margin — below 20% target (costs ${fmt(buyPerBox)}/box)`,
      tone: 'warn',
    }
  }
  return null
}

// ── Row ───────────────────────────────────────────────────────────────────────

function QtyRow({
  product,
  line,
  isInternal,
  onChange,
}: {
  product:    OrderProduct
  line:       LineItem | undefined
  isInternal: boolean
  onChange:   (id: string, line: LineItem | null) => void
}) {
  const qty       = line?.qty ?? 0
  const unitType  = line?.unitType  ?? (isInternal ? 'box' : 'retail_unit')
  // David's wholesale guideline — pre-fill as a suggestion, stays editable.
  const defaultPrice = isInternal
    ? product.lastBuyCostPence ?? 0
    : suggestedWholesalePrice({
        name: product.name, unitType, retailPence: product.retailPrice,
        boxCostPence: product.lastBuyCostPence, typicalBoxCount: product.typicalBoxCount,
      })
  const price     = line?.pricePence ?? defaultPrice

  function set(patch: Partial<LineItem>) {
    const next = { qty, unitType, pricePence: price, ...patch }
    if (next.qty <= 0) onChange(product.id, null)
    else onChange(product.id, next)
  }

  function toggleUnit() {
    const newUnit = unitType === 'box' ? 'retail_unit' : 'box'
    // Box vs loose price differently — re-suggest for the new unit.
    const suggested = isInternal ? price : suggestedWholesalePrice({
      name: product.name, unitType: newUnit, retailPence: product.retailPrice,
      boxCostPence: product.lastBuyCostPence, typicalBoxCount: product.typicalBoxCount,
    })
    set({ unitType: newUnit, pricePence: suggested })
  }

  const alert = qty > 0 ? getPricingAlert(price, unitType, product.lastBuyCostPence, product.typicalBoxCount) : null

  const unitLabel = unitType === 'box' ? 'box' : product.unitLabel

  return (
    <div className={`py-2 ${qty > 0 ? '' : 'opacity-75'}`}>
      <div className="flex items-center gap-2">
        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
          {product.orderCount > 0 && product.avgQty > 0 && (
            <p className="text-[9px] text-gray-400">
              usual {product.avgQty} {product.avgUnitType === 'box' ? 'boxes' : product.unitLabel + 's'}
            </p>
          )}
        </div>

        {/* Price input — hidden for internal (F&F shop) */}
        {!isInternal && (
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-[10px] text-gray-400">£</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.50"
              min="0"
              value={price > 0 ? (price / 100).toFixed(2) : ''}
              onChange={e => set({ pricePence: Math.round(parseFloat(e.target.value || '0') * 100) })}
              placeholder="0.00"
              className={`w-14 px-1 py-1 rounded-lg text-xs font-mono border text-gray-900 outline-none
                [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
                ${alert?.tone === 'loss' ? 'border-red-400 bg-red-50'
                : alert?.tone === 'warn' ? 'border-amber-400 bg-amber-50'
                : 'border-gray-200 bg-white'}`}
            />
            <span className="text-[9px] text-gray-400">/{unitLabel}</span>
          </div>
        )}

        {/* Unit toggle */}
        <button
          onClick={toggleUnit}
          className="text-[9px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 shrink-0 active:bg-gray-50"
        >
          {unitType === 'box' ? 'bx' : 'unit'}
        </button>

        {/* Qty stepper */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => set({ qty: qty - 1 })}
            className="w-7 h-7 rounded-lg border border-gray-300 bg-white font-bold flex items-center justify-center active:bg-gray-100 text-gray-900">−</button>
          <span className="w-6 text-center text-sm font-bold text-gray-900">{qty}</span>
          <button onClick={() => set({ qty: qty + 1 })}
            className="w-7 h-7 rounded-lg border border-gray-300 bg-white font-bold flex items-center justify-center active:bg-gray-100 text-gray-900">+</button>
        </div>
      </div>

      {/* Pricing alert — only when qty > 0 and there's a problem */}
      {alert && (
        <p className={`text-[10px] mt-0.5 pl-0 font-medium leading-tight ${
          alert.tone === 'loss' ? 'text-red-600' : 'text-amber-600'
        }`}>
          {alert.tone === 'loss' ? '🔴' : '⚠'} {alert.text}
        </p>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function OrderClient({
  customer,
  products,
  defaultDeliveryDate,
  draftItems,
  draftOrderId,
}: {
  customer:            OrderCustomer
  products:            OrderProduct[]
  defaultDeliveryDate: string
  draftItems:          Record<string, { qty: number; unitType: 'box' | 'retail_unit'; pricePence: number }>
  draftOrderId:        string | null
}) {
  const router = useRouter()

  const [tab,          setTab]          = useState<'veg' | 'fruit'>('veg')
  const [lines,        setLines]        = useState<Map<string, LineItem>>(() => {
    const m = new Map<string, LineItem>()
    if (Object.keys(draftItems).length > 0) {
      for (const [id, v] of Object.entries(draftItems)) m.set(id, v)
    } else {
      // Pre-fill favourites with usual qty + the suggested wholesale price
      for (const p of products) {
        if (p.orderCount > 0 && p.avgQty > 0) {
          m.set(p.id, {
            qty:        p.avgQty,
            unitType:   p.avgUnitType,
            pricePence: suggestedWholesalePrice({
              name: p.name, unitType: p.avgUnitType, retailPence: p.retailPrice,
              boxCostPence: p.lastBuyCostPence, typicalBoxCount: p.typicalBoxCount,
            }),
          })
        }
      }
    }
    return m
  })
  const [deliveryDate,  setDeliveryDate]  = useState(defaultDeliveryDate)
  const [showCatalogue, setShowCatalogue] = useState(false)
  const [search,        setSearch]        = useState('')
  const [saving,        setSaving]        = useState(false)

  function onChange(id: string, line: LineItem | null) {
    setLines(prev => {
      const next = new Map(prev)
      if (line === null) next.delete(id)
      else next.set(id, line)
      return next
    })
  }

  const tabProducts = useMemo(() => products.filter(p => p.category === tab), [products, tab])
  const favourites  = useMemo(() => tabProducts.filter(p => p.orderCount > 0), [tabProducts])
  const catalogue   = useMemo(() => tabProducts.filter(p => p.orderCount === 0), [tabProducts])
  const filtered    = useMemo(() =>
    !search ? catalogue : catalogue.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [catalogue, search])

  // Count active lines AND count alerts
  const activeLines = [...lines.values()].filter(l => l.qty > 0)
  const totalItems  = activeLines.length
  const alertCount  = activeLines.filter(l => {
    const p = products.find(x => x.id === [...lines.entries()].find(([, v]) => v === l)?.[0])
    if (!p) return false
    return !!getPricingAlert(l.pricePence, l.unitType, p.lastBuyCostPence, p.typicalBoxCount)
  }).length

  async function handleSave(confirm: boolean) {
    setSaving(true)
    try {
      const items = [...lines.entries()]
        .filter(([, l]) => l.qty > 0)
        .map(([productId, l]) => ({
          productId,
          quantity:   l.qty,
          unitType:   l.unitType,
          unitPrice:  l.pricePence,
        }))

      const orderId = await upsertOrder(customer.id, deliveryDate, items)
      if (confirm) await confirmOrder(orderId)
      router.push('/order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500">Ordering for</p>
          <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 mb-0.5">Delivery</p>
          <input
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['veg', 'fruit'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowCatalogue(false); setSearch('') }}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'
            }`}
          >
            {t === 'veg' ? '🥦 Vegetables' : '🍎 Fruit'}
          </button>
        ))}
      </div>

      {/* Favourites */}
      {favourites.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
            {customer.isInternal ? 'What does the shop need?' : 'Their usual order'}
          </p>
          <div className="divide-y divide-gray-100">
            {favourites.map(p => (
              <QtyRow key={p.id} product={p} line={lines.get(p.id)} isInternal={customer.isInternal} onChange={onChange} />
            ))}
          </div>
        </div>
      )}

      {/* Catalogue */}
      {!showCatalogue ? (
        <button
          onClick={() => setShowCatalogue(true)}
          className="w-full text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl py-2.5 active:bg-gray-50"
        >
          + Add {tab === 'veg' ? 'vegetable' : 'fruit'}
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              autoFocus
              placeholder={`Search ${tab === 'veg' ? 'vegetables' : 'fruit'}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm outline-none text-gray-900"
            />
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto px-3">
            {filtered.map(p => (
              <QtyRow key={p.id} product={p} line={lines.get(p.id)} isInternal={customer.isInternal} onChange={onChange} />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No results</p>
            )}
          </div>
          <button
            onClick={() => { setShowCatalogue(false); setSearch('') }}
            className="w-full text-xs text-gray-400 py-2 border-t border-gray-100 active:bg-gray-50"
          >Done</button>
        </div>
      )}

      {/* Save bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto space-y-1.5">
            {alertCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                <p className="text-xs font-semibold text-red-700">
                  {alertCount} pricing {alertCount === 1 ? 'problem' : 'problems'} — review before confirming
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 bg-white active:bg-gray-50"
              >
                Save draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white active:opacity-80 ${
                  alertCount > 0 ? 'bg-red-600' : 'bg-gray-900'
                }`}
              >
                {saving ? '…' : `Confirm (${totalItems} items)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
