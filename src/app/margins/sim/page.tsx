'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'

interface Product {
  id: string
  name: string
  retail_price: number
  purchase_cost: number
}

export default function SimulatorPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [delta, setDelta] = useState(5)
  const [weeklySales, setWeeklySales] = useState(50)

  useEffect(() => {
    fetch('/api/products/simple-list')
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
  }, [])

  const product = products.find(p => p.id === productId)
  const newPrice = product ? product.retail_price + delta : 0
  const newMargin = newPrice > 0 && product
    ? (newPrice - product.purchase_cost) / newPrice
    : 0
  const extraWeekly = delta * weeklySales
  const extraAnnual = extraWeekly * 52

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/margins" className="text-brand-accent min-h-[48px] min-w-[48px]
                                          flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Profit Simulator</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">Product</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}
                  className="input-field">
            <option value="">— Select a product —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Price change (pence)
          </label>
          <input
            type="text" inputMode="numeric" pattern="-?[0-9]*"
            value={delta === 0 ? '' : delta}
            onChange={e => setDelta(parseInt(e.target.value.replace(/[^0-9-]/g, '')) || 0)}
            className="input-field" placeholder="e.g. 5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            Avg weekly sales (units)
          </label>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={weeklySales === 0 ? '' : weeklySales}
            onChange={e => setWeeklySales(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            className="input-field" placeholder="e.g. 50"
          />
        </div>
      </div>

      {product && (
        <div className="card mt-6 space-y-3">
          <p className="font-semibold text-[var(--text-muted)] text-sm uppercase tracking-wide">
            Results
          </p>
          <ResultRow label="New retail price"
            value={formatPrice(newPrice)}
            highlight={newPrice !== product.retail_price} />
          <ResultRow label="New margin"
            value={formatMargin(newMargin)}
            highlight />
          <ResultRow label="Extra revenue / week"
            value={`${formatPrice(Math.abs(extraWeekly))}`}
            positive={extraWeekly >= 0} />
          <ResultRow label="Extra revenue / year"
            value={`${formatPrice(Math.abs(extraAnnual))}`}
            positive={extraAnnual >= 0} />
          {weeklySales === 50 && (
            <p className="text-xs text-[var(--text-muted)]">
              * Using your estimate of 50 units/week. Import EPOS sales data for actual figures.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({
  label, value, highlight = false, positive,
}: {
  label: string; value: string; highlight?: boolean; positive?: boolean
}) {
  const colour = positive === undefined
    ? highlight ? 'text-brand-accent' : 'text-[var(--text)]'
    : positive ? 'text-status-green' : 'text-status-red'
  return (
    <div className="flex justify-between items-center">
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
      <p className={`font-bold text-lg ${colour}`}>{value}</p>
    </div>
  )
}
