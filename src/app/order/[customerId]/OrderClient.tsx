'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { OrderProduct, OrderCustomer } from './page'
import { upsertOrder, confirmOrder } from '../actions'

type LineItem = { qty: number; unitType: 'box' | 'retail_unit' }

function fmt(p: number) { return `£${(p / 100).toFixed(2)}` }

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
  const qty      = line?.qty ?? 0
  const unitType = line?.unitType ?? (isInternal ? 'box' : 'retail_unit')
  const isFav    = product.orderCount > 0

  function setQty(n: number) {
    if (n <= 0) onChange(product.id, null)
    else        onChange(product.id, { qty: n, unitType })
  }

  function toggleUnit() {
    const next: 'box' | 'retail_unit' = unitType === 'box' ? 'retail_unit' : 'box'
    onChange(product.id, { qty, unitType: next })
  }

  const unitLabel = unitType === 'box'
    ? 'boxes'
    : product.unitLabel + (qty !== 1 ? 's' : '')

  return (
    <div className={`flex items-center gap-2 py-2 ${qty > 0 ? 'opacity-100' : 'opacity-80'}`}>
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
        {isFav && product.avgQty > 0 && (
          <p className="text-[9px] text-gray-400">usual {product.avgQty} {product.avgUnitType === 'box' ? 'boxes' : product.unitLabel + 's'}</p>
        )}
      </div>

      {/* Unit toggle */}
      <button
        onClick={toggleUnit}
        className="text-[9px] text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 shrink-0 active:bg-gray-50"
      >
        {unitType === 'box' ? 'bx' : 'unit'}
      </button>

      {/* Stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setQty(qty - 1)}
          className="w-7 h-7 rounded-lg border border-gray-300 bg-white font-bold flex items-center justify-center active:bg-gray-100 text-gray-900"
        >−</button>
        <span className="w-7 text-center text-sm font-bold text-gray-900">{qty}</span>
        <button
          onClick={() => setQty(qty + 1)}
          className="w-7 h-7 rounded-lg border border-gray-300 bg-white font-bold flex items-center justify-center active:bg-gray-100 text-gray-900"
        >+</button>
      </div>

      {/* Unit label */}
      <span className="text-[10px] text-gray-400 w-10 shrink-0">{qty > 0 ? unitLabel : ''}</span>
    </div>
  )
}

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
  draftItems:          Record<string, { qty: number; unitType: 'box' | 'retail_unit' }>
  draftOrderId:        string | null
}) {
  const router = useRouter()
  const [tab,          setTab]          = useState<'veg' | 'fruit'>('veg')
  const [lines,        setLines]        = useState<Map<string, LineItem>>(() => {
    const m = new Map<string, LineItem>()
    for (const [id, v] of Object.entries(draftItems)) m.set(id, v)
    // Pre-fill favourites with their usual qty (only if no draft)
    if (Object.keys(draftItems).length === 0) {
      for (const p of products) {
        if (p.orderCount > 0 && p.avgQty > 0) {
          m.set(p.id, { qty: p.avgQty, unitType: p.avgUnitType })
        }
      }
    }
    return m
  })
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate)
  const [showCatalogue, setShowCatalogue] = useState(false)
  const [search,       setSearch]       = useState('')
  const [saving,       setSaving]       = useState(false)

  function onChange(id: string, line: LineItem | null) {
    setLines(prev => {
      const next = new Map(prev)
      if (line === null) next.delete(id)
      else next.set(id, line)
      return next
    })
  }

  const tabProducts   = useMemo(() => products.filter(p => p.category === tab), [products, tab])
  const favourites    = useMemo(() => tabProducts.filter(p => p.orderCount > 0), [tabProducts])
  const catalogue     = useMemo(() => tabProducts.filter(p => p.orderCount === 0), [tabProducts])
  const filteredCat   = useMemo(() => {
    if (!search) return catalogue
    return catalogue.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [catalogue, search])

  const totalItems = [...lines.values()].filter(l => l.qty > 0).length

  async function handleSave(confirm: boolean) {
    setSaving(true)
    try {
      const items = [...lines.entries()]
        .filter(([, l]) => l.qty > 0)
        .map(([productId, l]) => {
          const p = products.find(x => x.id === productId)!
          return {
            productId,
            quantity:   l.qty,
            unitType:   l.unitType,
            unitPrice:  p.retailPrice,
          }
        })

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
            {customer.isInternal ? 'What do you need?' : 'Their usual order'}
          </p>
          <div className="divide-y divide-gray-100">
            {favourites.map(p => (
              <QtyRow
                key={p.id}
                product={p}
                line={lines.get(p.id)}
                isInternal={customer.isInternal}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add from catalogue */}
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
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {filteredCat.map(p => (
              <QtyRow
                key={p.id}
                product={p}
                line={lines.get(p.id)}
                isInternal={customer.isInternal}
                onChange={onChange}
              />
            ))}
            {filteredCat.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No results</p>
            )}
          </div>
          <button
            onClick={() => { setShowCatalogue(false); setSearch('') }}
            className="w-full text-xs text-gray-400 py-2 border-t border-gray-100 active:bg-gray-50"
          >
            Done
          </button>
        </div>
      )}

      {/* Save bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto flex gap-2">
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
              className="flex-1 py-3 rounded-xl bg-gray-900 text-sm font-semibold text-white active:bg-gray-700"
            >
              {saving ? '…' : `Confirm order (${totalItems} items)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
