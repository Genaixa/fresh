'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = {
  id:         string
  product_id: string
  quantity:   number
  unit_type:  string | null
  unit_price: number
  product:    { id: string; name: string } | null
}

type Order = {
  id:            string
  status:        string
  order_date:    string | null
  delivery_date: string | null
  customer:      { id: string; name: string; account_number: string | null } | null
  items:         Item[]
}

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

export default function DispatchDeliveryClient({
  order,
  prevOrderId,
  prevCustomerName,
  nextOrderId,
  nextCustomerName,
}: {
  order:            Order
  prevOrderId:      string | null
  prevCustomerName: string | null
  nextOrderId:      string | null
  nextCustomerName: string | null
}) {
  const router = useRouter()

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(order.items.map(i => [i.id, true]))
  )
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map(i => [i.id, Number(i.quantity)]))
  )
  // Editable at delivery (string state so typing isn't fought by re-formatting).
  const [priceStr, setPriceStr] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map(i => [i.id, (i.unit_price / 100).toFixed(2)]))
  )
  const priceOf = (id: string, fallback: number) => {
    const v = parseFloat(priceStr[id] ?? '')
    return isNaN(v) ? fallback : Math.round(v * 100)
  }
  const [dispatching, setDispatching] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState('')

  const alreadyDone = order.status === 'dispatched'

  const handedCount = order.items.filter(i => checked[i.id]).length
  const total = order.items.reduce((s, i) => {
    if (!checked[i.id]) return s
    return s + Math.round((quantities[i.id] ?? Number(i.quantity)) * priceOf(i.id, i.unit_price))
  }, 0)

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function adjustQty(id: string, delta: number) {
    setQuantities(prev => ({
      ...prev,
      // Whole units only — orders are in boxes/units, so no half-bananas.
      // To drop an item entirely, untick it rather than stepping to zero.
      [id]: Math.max(1, Math.round((prev[id] ?? 1) + delta)),
    }))
  }

  async function handleDispatch() {
    if (handedCount === 0) {
      setError('No items ticked — untap to remove, not to clear everything')
      return
    }
    setDispatching(true)
    setError('')
    try {
      const items = order.items
        .filter(i => checked[i.id])
        .map(i => ({
          product_id: i.product_id,
          quantity:   quantities[i.id] ?? Number(i.quantity),
          unit_price: priceOf(i.id, i.unit_price),
          unit_type:  i.unit_type,
        }))

      const res = await fetch(`/api/dispatch/${order.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push(nextOrderId ? `/dispatch/${nextOrderId}` : '/dispatch')
    } catch (err: any) {
      setError(err.message)
      setDispatching(false)
    }
  }

  async function handleUndo() {
    if (!confirm('Undo this delivery? The invoice will be voided and the order goes back to your dispatch list.')) return
    setUndoing(true); setError('')
    try {
      const res = await fetch(`/api/dispatch/${order.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/dispatch')
    } catch (err: any) {
      setError(err.message)
      setUndoing(false)
    }
  }

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between mb-3">
          <Link href="/dispatch" className="text-[var(--text-muted)] text-2xl leading-none">←</Link>
          <div className="text-right leading-none">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Deliver</p>
            <p className="text-xl font-bold text-brand-accent">
              {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'no date'}
            </p>
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold leading-tight">{order.customer?.name}</h1>
        <p className="text-center text-xs text-[var(--text-muted)] mt-1">Account {order.customer?.account_number ?? '—'}</p>
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] mt-2">
          <span>Ordered {order.order_date ? new Date(order.order_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
          <span className="opacity-40">·</span>
          <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* Prev / next */}
      <div className="flex items-center justify-between gap-2 mb-5">
        {prevOrderId
          ? <Link href={`/dispatch/${prevOrderId}`} className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-[var(--text-muted)] active:opacity-60 truncate">← {prevCustomerName}</Link>
          : <span />}
        {nextOrderId
          ? <Link href={`/dispatch/${nextOrderId}`} className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-[var(--text-muted)] active:opacity-60 truncate">{nextCustomerName} →</Link>
          : <span className="px-3 py-1.5 text-xs text-[var(--text-muted)]">Last delivery</span>}
      </div>

      {alreadyDone ? (
        <div className="card text-center py-10 space-y-4">
          <p className="text-lg font-semibold">Already dispatched</p>
          {error && <p className="text-status-red text-sm">{error}</p>}
          <Link href="/dispatch" className="btn-primary inline-block">Back to deliveries</Link>
          <button onClick={handleUndo} disabled={undoing}
            className="block mx-auto text-sm text-status-red underline active:opacity-60 disabled:opacity-40">
            {undoing ? 'Undoing…' : 'Undo delivery (voids invoice)'}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {order.items.map(item => {
              const isChecked = checked[item.id]
              const qty       = quantities[item.id] ?? Number(item.quantity)
              const lineTotal = isChecked ? Math.round(qty * priceOf(item.id, item.unit_price)) : 0

              return (
                <div key={item.id}
                  className={`card transition-opacity ${!isChecked ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-3">
                    {/* Tap target: toggle checked */}
                    <button
                      onClick={() => toggle(item.id)}
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? 'bg-brand-accent border-brand-accent text-white'
                          : 'border-white/30 bg-transparent'
                      }`}
                    >
                      {isChecked && <span className="text-xl leading-none font-bold">✓</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-tight truncate">{item.product?.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-[var(--text-muted)]">£</span>
                        <input
                          type="number" inputMode="decimal" step="0.50" min="0"
                          value={priceStr[item.id] ?? ''}
                          onChange={e => setPriceStr(p => ({ ...p, [item.id]: e.target.value }))}
                          disabled={!isChecked}
                          className="w-20 px-2 py-1 rounded-md border border-white/25 bg-white/10 text-[var(--text)] text-sm font-mono outline-none focus:border-brand-accent disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-[var(--text-muted)]">{item.unit_type === 'box' ? 'box' : 'each'}</span>
                        <button
                          onClick={() => setPriceStr(p => ({ ...p, [item.id]: (item.unit_price / 100).toFixed(2) }))}
                          aria-label="Reset price"
                          className={`text-base text-brand-accent active:opacity-60 ml-1 leading-none ${priceOf(item.id, item.unit_price) !== item.unit_price ? '' : 'invisible'}`}
                        >↺</button>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => adjustQty(item.id, -1)}
                        disabled={!isChecked}
                        className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:opacity-60"
                      >−</button>
                      <span className="w-9 text-center font-bold text-base tabular-nums">
                        {qty % 1 === 0 ? qty : qty.toFixed(1)}
                      </span>
                      <button
                        onClick={() => adjustQty(item.id, 1)}
                        disabled={!isChecked}
                        className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg font-bold disabled:opacity-30 active:opacity-60"
                      >+</button>
                    </div>

                    <p className="w-14 text-right font-bold text-sm shrink-0 tabular-nums">
                      {isChecked ? pence(lineTotal) : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Items count · total · deliver action — all on one line */}
          {error && <p className="text-status-red text-sm mb-2">{error}</p>}
          <div className="card flex items-center justify-between gap-2">
            <p className="text-[var(--text-muted)] text-sm shrink-0">{handedCount}/{order.items.length} items</p>
            <p className="text-xl font-bold text-brand-accent">{pence(total)}</p>
            <button
              onClick={handleDispatch}
              disabled={dispatching || handedCount === 0}
              className="btn-primary px-4 py-2.5 text-sm font-bold disabled:opacity-50 rounded-lg shrink-0"
            >
              {dispatching ? 'Invoicing…' : 'Deliver & invoice'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
