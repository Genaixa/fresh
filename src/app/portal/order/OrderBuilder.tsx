'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface Fav { product_id: string; name: string; unit: string; unit_type: string; times: number }
interface LastLine { product_id: string; name: string; unit: string; unit_type: string; quantity: number }
interface Meta { name: string; unit: string; unit_type: string }

// Next deliverable day = tomorrow, skipping Sat/Sun (David delivers Mon–Fri).
function nextWeekday() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// Parse a YYYY-MM-DD as local midnight so the weekday/label never drift a day.
function asLocal(iso: string) { return new Date(iso + 'T00:00:00') }
function isWeekend(iso: string) { const g = asLocal(iso).getDay(); return g === 0 || g === 6 }
function weekdayLabel(iso: string) {
  if (!iso) return ''
  return asLocal(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function OrderBuilder({ customerName, favourites, lastOrder, lastOrderDate, orderContacts = [] }: {
  customerName: string; favourites: Fav[]; lastOrder: LastLine[]; lastOrderDate?: string | null; orderContacts?: string[]
}) {
  const todayISO = new Date().toISOString().split('T')[0]
  const [deliveryDate, setDeliveryDate] = useState(nextWeekday())
  const [confirming, setConfirming] = useState(false)
  // When a customer has more than one orderer (e.g. Yeshiva Gedola's two cooks
  // sharing one login), they pick who's ordering — purely a label; all orders
  // still sit under the one customer and amalgamate.
  const [placedBy, setPlacedBy] = useState(orderContacts.length > 1 ? orderContacts[0] : '')
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

  // Remove an added item outright (the ✕). Reducing qty to 0 leaves the tile in
  // place — only the ✕ takes it off the list, so an adjustment can't lose it.
  function removeExtra(id: string) {
    setExtras(es => es.filter(e => e.id !== id))
    setQty(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const lineCount = Object.values(qty).filter(v => v > 0).length

  // Reset the whole order in one tap (e.g. after an accidental "repeat last").
  function clearAll() { setQty({}); setConfirming(false) }

  // The order spelled out, for the confirm sheet — built from current state only.
  const orderLines = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([pid, q]) => {
      const m = meta[pid]
      const ut = unitSel[pid] ?? (m?.unit_type === 'box' ? 'box' : 'retail_unit')
      return { pid, name: m?.name ?? '', q, unitLabel: ut === 'box' ? 'box' : (m?.unit ?? '') }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const dateError = isWeekend(deliveryDate)
    ? 'We deliver Monday–Friday — please pick a weekday.'
    : deliveryDate < todayISO ? "Delivery date can't be in the past." : ''

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
          placed_by_name: placedBy || null,
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
          Thanks {customerName} — we've got your order for{' '}
          {new Date(deliveryDate).toLocaleDateString('en-GB')}.
        </p>
        <p className="text-[var(--text-muted)] text-xs mb-6 max-w-xs mx-auto">
          Need to add something? Just place another order. To change this one, call or text us.
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

      {orderContacts.length > 1 && (
        <div className="card mb-4">
          <label className="label">Ordering as</label>
          <select className="input" value={placedBy} onChange={e => setPlacedBy(e.target.value)}>
            {orderContacts.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div className="card mb-4">
        <label className="label">Delivery date</label>
        <input className="input" type="date" value={deliveryDate} min={todayISO}
          onChange={e => setDeliveryDate(e.target.value)} />
        {dateError
          ? <p className="text-amber-400 text-xs mt-2">{dateError}</p>
          : <p className="text-[var(--text-muted)] text-xs mt-2">{weekdayLabel(deliveryDate)}</p>}
      </div>

      {lastOrder.length > 0 && (
        <button onClick={repeatLast} className="btn-primary w-full py-3 mb-5 font-semibold">
          ↻ Repeat last order{lastOrderDate ? ` — ${weekdayLabel(lastOrderDate)}` : ''} ({lastOrder.length} item{lastOrder.length === 1 ? '' : 's'})
        </button>
      )}

      {favourites.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Your usuals</h2>
            {lineCount > 0 && (
              <button onClick={clearAll} className="text-[var(--text-muted)] text-xs underline">Clear all</button>
            )}
          </div>
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
                onSet={n => setExact(e.id, n)} onRemove={() => removeExtra(e.id)} />
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
        <label className="label">Note <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
        <textarea className="input min-h-[88px] resize-none" rows={3}
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <p className="text-[var(--text-muted)] text-xs mb-4 leading-relaxed">
        Once placed, your order is final. To add more, just start another order.
        To change or cancel something, call or text us as soon as you can.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10">
        <button onClick={() => { if (dateError) { setError(dateError); return } setError(''); setConfirming(true) }}
          disabled={lineCount === 0}
          className="btn-primary w-full py-3.5 font-semibold disabled:opacity-50">
          {lineCount === 0 ? 'Add items to order'
            : `Review order · ${lineCount} item${lineCount === 1 ? '' : 's'}`}
        </button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setConfirming(false)}>
          <div className="card w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Confirm your order</h2>
            <p className="text-[var(--text-muted)] text-sm mb-3">
              Delivery <span className="text-[var(--text)] font-medium">{weekdayLabel(deliveryDate)}</span>
            </p>
            <div className="flex-1 overflow-y-auto -mx-1 px-1 divide-y divide-white/10">
              {orderLines.map(l => (
                <div key={l.pid} className="flex items-center justify-between py-2 text-sm">
                  <span>{l.name}</span>
                  <span className="font-semibold tabular-nums">{l.q} <span className="text-[var(--text-muted)] font-normal">{l.unitLabel}</span></span>
                </div>
              ))}
            </div>
            {notes.trim() && (
              <p className="text-[var(--text-muted)] text-xs mt-3 border-t border-white/10 pt-3">
                Note: <span className="text-[var(--text)]">{notes.trim()}</span>
              </p>
            )}
            <p className="text-[var(--text-muted)] text-xs mt-3">Once placed, your order is final.</p>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setConfirming(false)} disabled={saving}
                className="flex-1 py-3 rounded-lg border border-white/20 font-semibold disabled:opacity-50">Back</button>
              <button onClick={submit} disabled={saving}
                className="btn-primary flex-1 py-3 font-semibold disabled:opacity-50">
                {saving ? 'Placing…' : `Confirm · ${lineCount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ name, looseUnit, sel, onUnit, q, onMinus, onPlus, onSet, onRemove }: {
  name: string; looseUnit: string; sel: 'box' | 'retail_unit'
  onUnit: (ut: 'box' | 'retail_unit') => void
  q: number; onMinus: () => void; onPlus: () => void; onSet: (n: number) => void
  onRemove?: () => void
}) {
  const seg = (active: boolean) =>
    `flex-1 !min-h-0 h-9 rounded-md text-xs font-semibold transition-colors ${
      active ? 'bg-brand-accent text-white' : 'text-[var(--text-muted)]'
    }`
  return (
    <div className={`card !p-3 flex flex-col justify-between relative ${q > 0 ? 'ring-2 ring-brand-accent' : ''}`}>
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${name}`}
          className="absolute top-1 right-1 h-7 w-7 rounded-full flex items-center justify-center
                     text-[var(--text-muted)] hover:text-white hover:bg-white/10 text-base leading-none">✕</button>
      )}
      <div className="mb-3">
        <p className="font-medium text-sm leading-tight mb-2 pr-6">{name}</p>
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
