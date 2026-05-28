'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

const STATUS_COLOR: Record<string, string> = {
  draft:      'bg-zinc-700 text-zinc-300',
  confirmed:  'bg-blue-900 text-blue-300',
  dispatched: 'bg-green-900 text-green-300',
  cancelled:  'bg-red-900 text-red-300',
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [order, setOrder]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [dispatching, setDisp]  = useState(false)
  const [error, setError]       = useState('')

  async function load() {
    const res = await fetch(`/api/wholesale/orders/${id}`)
    if (res.ok) setOrder(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function dispatch() {
    if (!confirm('Mark as dispatched and generate invoice?')) return
    setDisp(true)
    setError('')
    try {
      const res = await fetch(`/api/wholesale/orders/${id}/dispatch`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/wholesale/invoices/${data.invoice_id}`)
    } catch (err: any) {
      setError(err.message)
      setDisp(false)
    }
  }

  if (loading) return <div className="page"><p className="text-[var(--text-muted)]">Loading…</p></div>
  if (!order)  return <div className="page"><p className="text-red-400">Order not found</p></div>

  const total = (order.items ?? []).reduce(
    (s: number, i: any) => s + Math.round(i.quantity * i.unit_price), 0
  )

  return (
    <div className="page pb-32">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/wholesale/customers/${order.customer_id}`} className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">Order</h1>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? ''}`}>
          {order.status}
        </span>
      </div>

      {/* Header info */}
      <div className="card mb-4 space-y-1 text-sm">
        <p className="font-semibold text-base">{order.customer?.name}</p>
        <p className="text-[var(--text-muted)]">
          Order date: {new Date(order.order_date).toLocaleDateString('en-GB')}
        </p>
        {order.delivery_date && (
          <p className="text-[var(--text-muted)]">
            Delivery: {new Date(order.delivery_date).toLocaleDateString('en-GB')}
          </p>
        )}
        {order.notes && <p className="text-[var(--text-muted)] italic">{order.notes}</p>}
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {(order.items ?? []).map((item: any) => (
          <div key={item.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{item.product?.name}</p>
              <p className="text-[var(--text-muted)] text-xs">
                {item.quantity} × {pence(item.unit_price)}
              </p>
            </div>
            <p className="font-bold">{pence(Math.round(item.quantity * item.unit_price))}</p>
          </div>
        ))}

        <div className="card flex items-center justify-between">
          <p className="font-semibold">Total</p>
          <p className="text-xl font-bold text-brand-accent">{pence(total)}</p>
        </div>
      </div>

      {/* Invoice link if dispatched */}
      {order.status === 'dispatched' && order.invoice_id && (
        <Link href={`/wholesale/invoices/${order.invoice_id}`}
          className="card block text-center text-brand-accent mb-4">
          View Invoice →
        </Link>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Actions */}
      {order.status !== 'dispatched' && order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10">
          <button onClick={dispatch} disabled={dispatching}
            className="btn-primary w-full py-4 text-lg font-semibold">
            {dispatching ? 'Generating invoice…' : 'Dispatch & Generate Invoice'}
          </button>
        </div>
      )}
    </div>
  )
}
