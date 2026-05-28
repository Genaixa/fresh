'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { WholesaleCustomer, Product } from '@/types'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

interface OrderLine {
  product: Product
  quantity: string
  unit_price: number  // pence, editable
}

function NewOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomer = searchParams.get('customer')

  const [customers, setCustomers] = useState<WholesaleCustomer[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [customerId, setCustomerId] = useState(preselectedCustomer ?? '')
  const [orderDate, setOrderDate]   = useState(new Date().toISOString().split('T')[0])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes]           = useState('')
  const [lines, setLines]           = useState<OrderLine[]>([])
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    fetch('/api/wholesale/customers').then(r => r.json()).then(setCustomers)
    fetch('/api/products').then(r => r.json()).then((data: Product[]) =>
      setProducts(data.filter(p => p.is_active))
    )
  }, [])

  const filtered = products.filter(p =>
    search.length > 1
      ? p.name.toLowerCase().includes(search.toLowerCase())
      : false
  )

  function addLine(product: Product) {
    if (lines.find(l => l.product.id === product.id)) return
    setLines(ls => [...ls, { product, quantity: '1', unit_price: product.wholesale_price }])
    setSearch('')
  }

  function updateQty(productId: string, qty: string) {
    setLines(ls => ls.map(l => l.product.id === productId ? { ...l, quantity: qty } : l))
  }

  function updatePrice(productId: string, price: string) {
    const p = Math.round(parseFloat(price) * 100)
    if (!isNaN(p)) setLines(ls => ls.map(l => l.product.id === productId ? { ...l, unit_price: p } : l))
  }

  function removeLine(productId: string) {
    setLines(ls => ls.filter(l => l.product.id !== productId))
  }

  const total = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0
    return s + Math.round(qty * l.unit_price)
  }, 0)

  async function submit(status: 'draft' | 'confirmed') {
    if (!customerId)    { setError('Select a customer'); return }
    if (lines.length === 0) { setError('Add at least one item'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/wholesale/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id:   customerId,
          order_date:    orderDate,
          delivery_date: deliveryDate || null,
          notes:         notes || null,
          status,
          items: lines.map(l => ({
            product_id: l.product.id,
            quantity:   parseFloat(l.quantity) || 0,
            unit_price: l.unit_price,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      router.push(`/wholesale/orders/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="page pb-32">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wholesale" className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">New Order</h1>
      </div>

      {/* Customer + dates */}
      <div className="card space-y-4 mb-4">
        <div>
          <label className="label">Customer *</label>
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Order date</label>
            <input className="input" type="date" value={orderDate}
              onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Delivery date</label>
            <input className="input" type="date" value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="Any special instructions…" />
        </div>
      </div>

      {/* Product search */}
      <div className="card mb-4">
        <label className="label">Add product</label>
        <input
          className="input"
          placeholder="Type to search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addLine(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10
                           flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-[var(--text-muted)]">{pence(p.wholesale_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Order lines */}
      {lines.length > 0 && (
        <div className="space-y-2 mb-4">
          {lines.map(l => (
            <div key={l.product.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{l.product.name}</p>
                <button onClick={() => removeLine(l.product.id)}
                  className="text-red-400 text-xs min-h-[32px] min-w-[32px] flex items-center justify-center">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Qty ({l.product.unit})</label>
                  <input className="input text-center text-lg font-bold"
                    type="number" min="0" step="0.5"
                    value={l.quantity}
                    onChange={e => updateQty(l.product.id, e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Price (£)</label>
                  <input className="input text-center"
                    type="number" min="0" step="0.01"
                    defaultValue={(l.unit_price / 100).toFixed(2)}
                    onBlur={e => updatePrice(l.product.id, e.target.value)} />
                </div>
              </div>
              <p className="text-right text-[var(--text-muted)] text-xs mt-1">
                = {pence(Math.round((parseFloat(l.quantity) || 0) * l.unit_price))}
              </p>
            </div>
          ))}

          <div className="card flex items-center justify-between">
            <p className="font-semibold">Total</p>
            <p className="text-xl font-bold text-brand-accent">{pence(total)}</p>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10 flex gap-3">
        <button onClick={() => submit('draft')} disabled={saving}
          className="flex-1 py-3 rounded-xl border border-white/20 text-sm font-medium">
          Save Draft
        </button>
        <button onClick={() => submit('confirmed')} disabled={saving}
          className="flex-1 btn-primary py-3 text-sm font-medium">
          {saving ? 'Saving…' : 'Confirm Order'}
        </button>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="page">Loading…</div>}>
      <NewOrderForm />
    </Suspense>
  )
}
