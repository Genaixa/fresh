'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  category: 'fruit' | 'veg'
  unit: string
  avgByDow: Record<number, number> // 1=Mon..5=Fri -> typical units
  total: number
}
interface CatItem { id: string; name: string; category: 'fruit' | 'veg'; unit: string }

// Next trading day = tomorrow, skipping Sat/Sun (shop closed Sundays, Sat = Shabbat).
function nextTradingDay() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
function asLocal(iso: string) { return new Date(iso + 'T00:00:00') }
function dowOf(iso: string) { return asLocal(iso).getDay() }
function weekdayName(iso: string) { return asLocal(iso).toLocaleDateString('en-GB', { weekday: 'long' }) }
function weekdayLabel(iso: string) {
  return asLocal(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ShopOrderBuilder({
  customerId, products, catalogue, boxKg, boxEach, boxOpts,
}: {
  customerId: string; products: Product[]; catalogue: CatItem[]
  boxKg: Record<string, number>      // kg per box (weight items)
  boxEach: Record<string, number>    // default count per box (each items, e.g. cucumber 16)
  boxOpts: Record<string, number[]>  // selectable box sizes for the dropdown (each items)
}) {
  const todayISO = new Date().toISOString().split('T')[0]
  const [runDate, setRunDate] = useState(nextTradingDay())
  const [tab, setTab] = useState<'veg' | 'fruit'>('veg')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [perBox, setPerBox] = useState<Record<string, number>>({}) // chosen box size for 'each' items
  const [extras, setExtras] = useState<string[]>([])   // off-list items added via search
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(false)

  const dow = dowOf(runDate)

  // Lookups: favourites (with weekday avgs) + full catalogue.
  const favById = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const meta = useMemo(() => {
    const m = new Map<string, { name: string; category: 'fruit' | 'veg'; unit: string }>()
    for (const c of catalogue) m.set(c.id, { name: c.name, category: c.category, unit: c.unit })
    for (const p of products) m.set(p.id, { name: p.name, category: p.category, unit: p.unit })
    return m
  }, [products, catalogue])

  // Typical items for the selected weekday (avg > 0), and the pre-fill template.
  const typicalIds = useMemo(
    () => products.filter(p => (p.avgByDow[dow] ?? 0) > 0).map(p => p.id),
    [products, dow],
  )
  // Seed each typical line, snapping box-bought items to the NEAREST whole box so
  // the order starts on a buyable quantity (carrots 22kg → 20kg = 2 boxes, not 2.2).
  const template = useMemo(() => {
    const t: Record<string, number> = {}
    for (const id of typicalIds) {
      let v = favById.get(id)!.avgByDow[dow]
      const u = meta.get(id)?.unit
      const bs = u === 'kg' ? (boxKg[id] ?? 0) : u === 'each' ? (boxEach[id] ?? 0) : 0
      if (bs > 0 && v > 0) v = Math.max(1, Math.round(v / bs)) * bs
      t[id] = v
    }
    return t
  }, [typicalIds, favById, dow, meta, boxKg, boxEach])

  // New weekday → reset to that weekday's typical order, drop previous extras.
  useEffect(() => { setQty({ ...template }); setExtras([]); setPlaced(false) }, [template])

  // Items shown in the current tab = typical-for-weekday + added extras, in that category.
  const shownIds = useMemo(() => {
    const ids = [...typicalIds, ...extras]
    const seen = new Set<string>()
    return ids.filter(id => {
      if (seen.has(id)) return false
      seen.add(id)
      return meta.get(id)?.category === tab
    })
  }, [typicalIds, extras, tab, meta])

  // Search results = catalogue matches not already on screen.
  const onScreen = useMemo(() => new Set([...typicalIds, ...extras]), [typicalIds, extras])
  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return catalogue.filter(c => !onScreen.has(c.id) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, catalogue, onScreen])

  const countFor = (cat: 'fruit' | 'veg') =>
    Object.entries(qty).filter(([id, v]) => v > 0 && meta.get(id)?.category === cat).length
  const vegCount = countFor('veg'), fruitCount = countFor('fruit')
  const lineCount = vegCount + fruitCount

  function setOne(id: string, v: number) { setQty(q => ({ ...q, [id]: Math.max(0, Math.round(v)) })) }
  function fillTemplate() { setQty(q => ({ ...q, ...template })) }
  function clearAll() { setQty({}) }
  function addExtra(c: CatItem) {
    setExtras(e => (e.includes(c.id) ? e : [...e, c.id]))
    setQty(q => ({ ...q, [c.id]: q[c.id] && q[c.id] > 0 ? q[c.id] : 1 }))
    setTab(c.category)
    setSearch('')
  }

  async function submit() {
    if (lineCount === 0) { setError('Add at least one item'); return }
    setSaving(true); setError('')
    try {
      const items = Object.entries(qty)
        .filter(([, v]) => v > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity, unit_price: 0 }))
      const res = await fetch('/api/shop-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, delivery_date: runDate, items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not place the order')
      setPlaced(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (placed) {
    return (
      <div className="page text-center pt-20">
        <h1 className="text-xl font-bold mb-2">Shop order sent ✓</h1>
        <p className="text-[var(--text-muted)] mb-6">
          {lineCount} item{lineCount === 1 ? '' : 's'} for {weekdayLabel(runDate)} added to the buying list.
        </p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <a href="/market-run" className="btn-primary py-3 font-semibold rounded-lg">Go to Market Run →</a>
          <button onClick={() => { setPlaced(false); setQty({ ...template }); setExtras([]) }}
            className="py-3 rounded-lg border border-[var(--border)] font-semibold">Start another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page pb-40">
      <div className="flex items-center gap-1 mb-1">
        <Link href="/dashboard" aria-label="Back to home"
              className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Shop order</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-4">What the shop floor needs — feeds the market run.</p>

      <div className="card mb-4">
        <label className="label">Run date</label>
        <input className="input" type="date" value={runDate} min={todayISO}
          onChange={e => setRunDate(e.target.value)} />
        <p className="text-[var(--text-muted)] text-xs mt-2">
          {weekdayLabel(runDate)} · pre-filled with a typical {weekdayName(runDate)}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={fillTemplate}
          className="btn-primary flex-1 py-2.5 rounded-lg font-semibold text-sm">
          ↻ Fill typical {weekdayName(runDate)}
        </button>
        {lineCount > 0 && (
          <button onClick={clearAll} className="text-[var(--text-muted)] text-xs underline px-2">Clear all</button>
        )}
      </div>

      {/* Add anything — e.g. a one-off pre-order for an item not typically sold that day */}
      <div className="mb-4">
        <input className="input" placeholder="Add another item… (e.g. Lychees)"
          value={search} onChange={e => setSearch(e.target.value)} />
        {results.length > 0 && (
          <div className="card mt-1 p-0 divide-y divide-[var(--border)]">
            {results.map(c => (
              <button key={c.id} onClick={() => addExtra(c)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-black/5 flex justify-between">
                <span>{c.name}</span>
                <span className="text-[var(--text-muted)] text-xs capitalize">+ add · {c.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Veg / Fruit tabs */}
      <div className="flex mb-4 rounded-lg overflow-hidden border border-[var(--border)]">
        {(['veg', 'fruit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? 'bg-brand-accent text-white' : 'text-[var(--text-muted)]'
            }`}>
            {t === 'veg' ? 'Veg' : 'Fruit'}{(t === 'veg' ? vegCount : fruitCount) > 0 ? ` (${t === 'veg' ? vegCount : fruitCount})` : ''}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {shownIds.map(id => {
          const m = meta.get(id)!
          const q = qty[id] ?? 0
          const isExtra = !typicalIds.includes(id)
          return (
            <div key={id} className={`card ${q > 0 ? 'ring-1 ring-brand-accent' : ''}`}>
              <p className="font-medium text-sm mb-1 leading-tight">
                {m.name}{isExtra && <span className="text-brand-accent text-[10px] ml-1">• added</span>}
              </p>
              {(() => {
                const isKg   = m.unit === 'kg'
                const isEach = m.unit === 'each'
                const defBox = isKg ? (boxKg[id] ?? 0) : isEach ? (boxEach[id] ?? 0) : 0
                const hasBox = defBox > 0
                // Plain function (NOT a component) so the inputs keep focus across
                // renders — one stepper look reused so both rows are identical.
                const stepper = (value: string, dec: () => void, inc: () => void,
                                 onType: (n: number) => void, dashed = false) => (
                  <div className="flex items-center gap-1">
                    <button onClick={dec} disabled={q === 0}
                      className="w-8 h-8 rounded-md bg-black/5 disabled:opacity-40 text-lg leading-none">−</button>
                    <input type="number" inputMode="decimal" value={value}
                      onFocus={e => e.target.select()}
                      onChange={e => onType(Number(e.target.value) || 0)}
                      className={`w-full text-center bg-transparent rounded-md h-8 text-sm border ${dashed ? 'border-dashed' : ''} border-[var(--border)]`} />
                    <button onClick={inc}
                      className="w-8 h-8 rounded-md bg-black/5 text-lg leading-none">+</button>
                  </div>
                )

                if (!hasBox) {
                  return (
                    <>
                      <p className="text-[var(--text-muted)] text-[11px] mb-2">{m.unit}</p>
                      {stepper(`${q}`, () => setOne(id, q - 1), () => setOne(id, q + 1), n => setOne(id, n))}
                    </>
                  )
                }

                // Box size: fixed kg for weight items; for 'each' items the chosen
                // count (default case_size), changeable via the dropdown below.
                const bk = isKg ? defBox : (perBox[id] ?? defBox)
                const boxes = bk > 0 ? q / bk : 0
                const boxLabel = q === 0 ? '0' : Number.isInteger(boxes) ? `${boxes}` : boxes.toFixed(1)
                const setBoxes = (n: number) => setOne(id, Math.round(Math.max(0, n) * bk))
                const stepBoxes = (delta: number) => setBoxes(Math.round(boxes) + delta)
                const opts = boxOpts[id] ?? []
                const showDropdown = isEach && opts.length > 1
                const bkLabel = Number.isInteger(bk) ? `${bk}` : bk.toFixed(1)
                // Changing box size keeps the demand (each) and re-derives the box
                // COUNT — "I need ~64 cucumbers; at 18/box that's fewer boxes".
                const changeSize = (newSize: number) => {
                  if (!(newSize > 0)) return
                  setPerBox(p => ({ ...p, [id]: newSize }))
                }
                return (
                  <>
                    <p className="text-[var(--text-muted)] text-[11px] mb-1 flex items-center gap-1 flex-wrap">
                      <span>boxes ·</span>
                      {isKg ? (
                        <span className="opacity-70">{bkLabel}kg each</span>
                      ) : showDropdown ? (
                        <>
                          <select value={bk} onChange={e => changeSize(Number(e.target.value))}
                            className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-1 py-0.5 text-[11px]">
                            {opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="opacity-70">per box</span>
                        </>
                      ) : (
                        <span className="opacity-70">{bkLabel} each</span>
                      )}
                    </p>
                    {stepper(boxLabel, () => stepBoxes(-1), () => stepBoxes(1), n => setBoxes(n), true)}
                    <p className="text-[var(--text-muted)] text-[11px] mt-2 mb-1">{isKg ? 'kg' : 'each'}</p>
                    {/* He buys whole boxes, so the base ± steps by a full box; typing an
                        exact amount is still allowed for the odd part-box. */}
                    {stepper(`${q}`, () => stepBoxes(-1), () => stepBoxes(1), n => setOne(id, n))}
                  </>
                )
              })()}
            </div>
          )
        })}
        {shownIds.length === 0 && (
          <p className="col-span-2 text-center text-[var(--text-muted)] text-sm py-8">
            No typical {tab} for {weekdayName(runDate)} — use the search above to add items.
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      {/* Sits ABOVE the global bottom nav (h-16) so it isn't intercepted by it. */}
      <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto p-3 bg-[var(--bg-main)] border-t border-[var(--border)] z-40">
        <button onClick={submit} disabled={saving || lineCount === 0}
          className="btn-primary w-full py-3.5 font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Sending…'
            : lineCount === 0 ? 'Add items'
            : `Send to market run · ${lineCount} item${lineCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
