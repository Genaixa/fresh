'use client'

import { useState, useRef } from 'react'
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
  const [extras, setExtras] = useState<{ id: string; name: string; unit: string; unit_type: 'box' | 'retail_unit' }[]>([])
  // How each line is being ordered: a whole box, or loose in the product's own
  // unit. Seeded from the way the product was last bought so the default matches
  // the customer's habit; they can flip it per item.
  const [unitSel, setUnitSel] = useState<Record<string, 'box' | 'retail_unit'>>(() => {
    const s: Record<string, 'box' | 'retail_unit'> = {}
    for (const f of favourites) s[f.product_id] = f.unit_type === 'box' ? 'box' : 'retail_unit'
    for (const l of lastOrder)  s[l.product_id] = l.unit_type === 'box' ? 'box' : 'retail_unit'
    return s
  })
  const setUnit = (pid: string, ut: 'box' | 'retail_unit') =>
    setUnitSel(prev => ({ ...prev, [pid]: ut }))
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; name: string; unit: string; unit_type: 'box' | 'retail_unit' }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  // Lookup of every orderable product (favourites + last order + searched extras)
  const meta: Record<string, Meta> = {}
  for (const f of favourites) meta[f.product_id] = { name: f.name, unit: f.unit, unit_type: f.unit_type }
  for (const l of lastOrder) if (!meta[l.product_id]) meta[l.product_id] = { name: l.name, unit: l.unit, unit_type: l.unit_type }
  for (const e of extras)    if (!meta[e.id]) meta[e.id] = { name: e.name, unit: e.unit, unit_type: e.unit_type }

  const bump = (pid: string, d: number) =>
    setQty(prev => {
      const n = Math.max(0, (prev[pid] ?? 0) + d)
      const next = { ...prev }
      if (n === 0) delete next[pid]; else next[pid] = n
      return next
    })

  // Set a quantity directly (typed in), so a customer wanting 10 doesn't tap +10×.
  const setExact = (pid: string, n: number) =>
    setQty(prev => {
      const v = Math.max(0, n)
      const next = { ...prev }
      if (!v) delete next[pid]; else next[pid] = v
      return next
    })

  function repeatLast() {
    const next: Record<string, number> = {}
    const units: Record<string, 'box' | 'retail_unit'> = {}
    for (const l of lastOrder) {
      next[l.product_id]  = l.quantity
      units[l.product_id] = l.unit_type === 'box' ? 'box' : 'retail_unit'
    }
    setQty(next)
    setUnitSel(prev => ({ ...prev, ...units }))
  }

  // Fetched once, then filtered locally — avoids re-hitting the API per keystroke.
  const productCache = useRef<any[] | null>(null)

  async function runSearch(term: string) {
    setSearch(term)
    const t = term.trim().toLowerCase()
    if (t.length < 2) { setResults([]); return }
    try {
      if (!productCache.current) {
        const res = await fetch('/api/portal/products')
        if (!res.ok) throw new Error(`products ${res.status}`)
        const data = await res.json()
        productCache.current = Array.isArray(data) ? data : []
      }
      setResults(
        productCache.current
          .filter(p => {
            const n = p.name.toLowerCase()
            // Bidirectional match so plurals/extra letters still hit:
            // "aubergines" → "Aubergine", "tomatoes" → "Tomato", etc.
            return p.is_active && (n.includes(t) || (n.length >= 3 && t.includes(n)))
          })
          .slice(0, 8)
          // Seed the line's default from how the product is most commonly bought
          // across all customers; loose/each only when it's never been ordered.
          .map(p => ({ id: p.id, name: p.name, unit: p.unit, unit_type: p.default_unit_type === 'box' ? 'box' : 'retail_unit' as 'box' | 'retail_unit' }))
      )
    } catch {
      // Never let a transient fetch failure silently swallow the search box.
      setResults([])
    }
  }

  function addExtra(p: { id: string; name: string; unit: string; unit_type: 'box' | 'retail_unit' }) {
    if (!favourites.find(f => f.product_id === p.id) && !extras.find(e => e.id === p.id)) {
      setExtras(es => [...es, p])
    }
    setUnitSel(prev => prev[p.id] ? prev : { ...prev, [p.id]: p.unit_type })
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
            .map(([pid, q]) => ({
              product_id: pid,
              quantity: q,
              unit_type: unitSel[pid] ?? (meta[pid]?.unit_type === 'box' ? 'box' : 'retail_unit'),
            })),
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
              <Tile key={f.product_id} name={f.name} looseUnit={f.unit} q={qty[f.product_id] ?? 0}
                sel={unitSel[f.product_id] ?? 'retail_unit'} onUnit={ut => setUnit(f.product_id, ut)}
                onMinus={() => bump(f.product_id, -1)} onPlus={() => bump(f.product_id, 1)}
                onSet={n => setExact(f.product_id, n)} />
            ))}
          </div>
        </>
      )}

      {extraTiles.length > 0 && (
        <>
          <h2 className="font-semibold mb-3">Added items</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {extraTiles.map(e => (
              <Tile key={e.id} name={e.name} looseUnit={e.unit} q={qty[e.id] ?? 0}
                sel={unitSel[e.id] ?? e.unit_type} onUnit={ut => setUnit(e.id, ut)}
                onMinus={() => bump(e.id, -1)} onPlus={() => bump(e.id, 1)}
                onSet={n => setExact(e.id, n)} />
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

function Tile({ name, looseUnit, sel, onUnit, q, onMinus, onPlus, onSet }: {
  name: string; looseUnit: string; sel: 'box' | 'retail_unit'
  onUnit: (ut: 'box' | 'retail_unit') => void
  q: number; onMinus: () => void; onPlus: () => void; onSet: (n: number) => void
}) {
  const seg = (active: boolean) =>
    `flex-1 !min-h-0 h-9 rounded-md text-xs font-semibold transition-colors ${
      active ? 'bg-brand-accent text-white' : 'text-[var(--text-muted)]'
    }`
  return (
    <div className={`card !p-3 flex flex-col justify-between ${q > 0 ? 'ring-2 ring-brand-accent' : ''}`}>
      <div className="mb-3">
        <p className="font-medium text-sm leading-tight mb-2">{name}</p>
        {/* Order as a whole box, or loose in the product's own unit */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-black/20 border border-white/10">
          <button onClick={() => onUnit('box')} aria-pressed={sel === 'box'} className={seg(sel === 'box')}>Box</button>
          <button onClick={() => onUnit('retail_unit')} aria-pressed={sel === 'retail_unit'} className={seg(sel === 'retail_unit')}>{looseUnit}</button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={onMinus} disabled={q <= 0} aria-label={`Decrease ${name}`}
          className="h-11 w-11 rounded-lg border border-white/20 text-xl leading-none disabled:opacity-30">−</button>
        <input type="text" inputMode="numeric" aria-label={`Quantity ${name}`}
          value={q || ''} placeholder="0"
          onChange={e => onSet(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0))}
          onFocus={e => e.target.select()}
          className="w-12 h-11 text-center text-lg font-bold bg-transparent border border-white/15 rounded-lg focus:outline-none focus:border-brand-accent" />
        <button onClick={onPlus} aria-label={`Increase ${name}`}
          className="h-11 w-11 rounded-lg bg-white/10 text-xl leading-none">+</button>
      </div>
    </div>
  )
}
