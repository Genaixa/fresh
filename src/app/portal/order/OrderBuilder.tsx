'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Fav { product_id: string; name: string; unit: string; unit_type: string; times: number }
interface LastLine { product_id: string; name: string; unit: string; unit_type: string; quantity: number }
interface Meta { name: string; unit: string; unit_type: string }

function nextDay() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function OrderBuilder({ customerName, favourites, lastOrder }: {
  customerName: string; favourites: Fav[]; lastOrder: LastLine[]
}) {
  const [deliveryDate, setDeliveryDate] = useState(nextDay())
  const [notes, setNotes]   = useState('')
  const [qty, setQty]       = useState<Record<string, number>>({})
  const [extras, setExtras] = useState<{ id: string; name: string; unit: string }[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; unit: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  // Lookup of every orderable product (favourites + last order + searched extras)
  const meta: Record<string, Meta> = {}
  for (const f of favourites) meta[f.product_id] = { name: f.name, unit: f.unit, unit_type: f.unit_type }
  for (const l of lastOrder) if (!meta[l.product_id]) meta[l.product_id] = { name: l.name, unit: l.unit, unit_type: l.unit_type }
  for (const e of extras)    if (!meta[e.id]) meta[e.id] = { name: e.name, unit: e.unit, unit_type: 'retail_unit' }

  const bump = (pid: string, d: number) =>
    setQty(prev => {
      const n = Math.max(0, (prev[pid] ?? 0) + d)
      const next = { ...prev }
      if (n === 0) delete next[pid]; else next[pid] = n
      return next
    })

  function repeatLast() {
    const next: Record<string, number> = {}
    for (const l of lastOrder) next[l.product_id] = l.quantity
    setQty(next)
  }

  async function runSearch(term: string) {
    setSearch(term)
    if (term.trim().length < 2) { setResults([]); return }
    const res = await fetch('/api/products')
    const data = await res.json()
    setResults(
      (data as any[])
        .filter(p => p.is_active && p.name.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 8)
        .map(p => ({ id: p.id, name: p.name, unit: p.unit }))
    )
  }

  function addExtra(p: { id: string; name: string; unit: string }) {
    if (!favourites.find(f => f.product_id === p.id) && !extras.find(e => e.id === p.id)) {
      setExtras(es => [...es, p])
    }
    bump(p.id, 1)
    setSearch(''); setResults([])
  }

  const lineCount = Object.values(qty).filter(v => v > 0).length

  async function submit() {
    if (lineCount === 0) { setError('Add at least one item'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: deliveryDate || null,
          notes: notes.trim() || null,
          items: Object.entries(qty)
            .filter(([, q]) => q > 0)
            .map(([pid, q]) => ({ product_id: pid, quantity: q, unit_type: meta[pid]?.unit_type ?? 'retail_unit' })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not place order')
      setDone(true)
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  if (done) {
    return (
      <div className="page text-center pt-20">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold mb-2">Order placed</h1>
        <p className="text-[var(--text-muted)] mb-6">
          Thanks {customerName} — David has your order for{' '}
          {new Date(deliveryDate).toLocaleDateString('en-GB')}.
        </p>
        <p className="text-[var(--text-muted)] text-xs mb-6 max-w-xs mx-auto">
          Need to add something? Just place another order. To change this one, call or text David.
        </p>
        <Link href="/portal" className="btn-primary inline-block px-6 py-3">Back to account</Link>
      </div>
    )
  }

  const extraTiles = extras.filter(e => !favourites.find(f => f.product_id === e.id))

  return (
    <div className="page pb-40">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Place an order</h1>
        <Link href="/portal" className="text-[var(--text-muted)] text-sm">Account</Link>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-4">{customerName}</p>

      <div className="card mb-4">
        <label className="label">Delivery date</label>
        <input className="input" type="date" value={deliveryDate}
          onChange={e => setDeliveryDate(e.target.value)} />
      </div>

      {lastOrder.length > 0 && (
        <button onClick={repeatLast} className="btn-primary w-full py-3 mb-5 font-semibold">
          ↻ Repeat last order ({lastOrder.length} item{lastOrder.length === 1 ? '' : 's'})
        </button>
      )}

      {favourites.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">Your usuals</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {favourites.map(f => (
              <Tile key={f.product_id} name={f.name} unit={f.unit} q={qty[f.product_id] ?? 0}
                onMinus={() => bump(f.product_id, -1)} onPlus={() => bump(f.product_id, 1)} />
            ))}
          </div>
        </>
      )}

      {extraTiles.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">Added items</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {extraTiles.map(e => (
              <Tile key={e.id} name={e.name} unit={e.unit} q={qty[e.id] ?? 0}
                onMinus={() => bump(e.id, -1)} onPlus={() => bump(e.id, 1)} />
            ))}
          </div>
        </>
      )}

      <div className="card mb-4">
        <label className="label">Add something else</label>
        <input className="input" placeholder="Search products…" value={search}
          onChange={e => runSearch(e.target.value)} />
        {results.length > 0 && (
          <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
            {results.map(p => (
              <button key={p.id} onClick={() => addExtra(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm">
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <label className="label">Note for David <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
        <textarea className="input min-h-[88px] resize-none" rows={3}
          placeholder="Anything David should know — delivery time, where to leave it…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <p className="text-[var(--text-muted)] text-xs mb-4 leading-relaxed">
        Once placed, your order is final. To add more, just start another order.
        To change or cancel something, call or text David as soon as you can.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10">
        <button onClick={submit} disabled={saving || lineCount === 0}
          className="btn-primary w-full py-3.5 font-semibold disabled:opacity-50">
          {saving ? 'Placing…'
            : lineCount === 0 ? 'Add items to order'
            : `Place order · ${lineCount} item${lineCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}

function Tile({ name, unit, q, onMinus, onPlus }: {
  name: string; unit: string; q: number; onMinus: () => void; onPlus: () => void
}) {
  return (
    <div className={`card !p-3 flex flex-col justify-between ${q > 0 ? 'ring-2 ring-brand-accent' : ''}`}>
      <div className="mb-3">
        <p className="font-medium text-sm leading-tight">{name}</p>
        <p className="text-[var(--text-muted)] text-xs">{unit}</p>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={onMinus} disabled={q <= 0}
          className="h-11 w-11 rounded-lg border border-white/20 text-xl leading-none disabled:opacity-30">−</button>
        <span className="text-lg font-bold w-8 text-center">{q}</span>
        <button onClick={onPlus}
          className="h-11 w-11 rounded-lg bg-white/10 text-xl leading-none">+</button>
      </div>
    </div>
  )
}
