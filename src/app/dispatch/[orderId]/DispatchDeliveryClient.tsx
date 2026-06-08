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
  delivery_date: string | null
  customer:      { id: string; name: string } | null
  items:         Item[]
}

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

export default function DispatchDeliveryClient({
  order,
  nextOrderId,
  nextCustomerName,
}: {
  order:            Order
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
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState('')

  const alreadyDone = order.status === 'dispatched'

  const handedCount = order.items.filter(i => checked[i.id]).length
  const total = order.items.reduce((s, i) => {
    if (!checked[i.id]) return s
    return s + Math.round((quantities[i.id] ?? Number(i.quantity)) * i.unit_price)
  }, 0)

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function adjustQty(id: string, delta: number) {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0.5, (prev[id] ?? 1) + delta),
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
          unit_price: i.unit_price,
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

  return (
    <div className="page pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dispatch" className="text-[var(--text-muted)] text-2xl leading-none">←</Link>
        <h1 className="text-2xl font-bold">{order.customer?.name}</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-6 ml-9">
        {nextCustomerName ? `Next: ${nextCustomerName}` : 'Last delivery'}
      </p>

      {alreadyDone ? (
        <div className="card text-center py-10 space-y-4">
          <p className="text-lg font-semibold">Already dispatched</p>
          <Link href="/dispatch" className="btn-primary inline-block">Back to deliveries</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {order.items.map(item => {
              const isChecked = checked[item.id]
              const qty       = quantities[item.id] ?? Number(item.quantity)
              const lineTotal = isChecked ? Math.round(qty * item.unit_price) : 0

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
                      <p className="text-xs text-[var(--text-muted)]">{pence(item.unit_price)} each</p>
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

          {/* Running total */}
          <div className="card flex items-center justify-between mb-4">
            <p className="text-[var(--text-muted)]">
              {handedCount}/{order.items.length} items
            </p>
            <p className="text-2xl font-bold text-brand-accent">{pence(total)}</p>
          </div>

          {error && <p className="text-status-red text-sm mb-3">{error}</p>}
        </>
      )}

      {!alreadyDone && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10">
          <button
            onClick={handleDispatch}
            disabled={dispatching || handedCount === 0}
            className="btn-primary w-full py-5 text-xl font-bold disabled:opacity-50 rounded-xl"
          >
            {dispatching
              ? 'Generating invoice…'
              : `Dispatched → ${pence(total)}`}
          </button>
        </div>
      )}
    </div>
  )
}
