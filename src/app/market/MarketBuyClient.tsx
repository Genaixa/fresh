'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { closeMarketSession, completeSectionBatch, deleteMarketProduct, reopenSectionBatch, startNewTrip, upsertMarketItem } from './actions'
import { CONFIG } from './config'
import type { MarketProduct, MarketSession, MarketSessionItem, SupplierIds } from './page'

// ── Deal dot ──────────────────────────────────────────────────────────────────

// The whole deal engine now: the box price (what's on the invoice) this buy vs the
// buy before it. No per-unit division anywhere, so the parser's weight/count guesses
// can't create rubbish — it's just "did this box get dearer or cheaper since last time".

// Dot/border colour from the price direction: cheaper than last buy = green (good
// time to buy), dearer = red, about the same = amber, no history = null.
function moveStatus(current: number | null, prev: number | null): 'green' | 'amber' | 'red' | null {
  if (!current || !prev) return null
  const pct = (current - prev) / prev
  return pct <= -0.10 ? 'green' : pct >= 0.10 ? 'red' : 'amber'
}

// The advisory line under each supplier: "▼ was £5.00 · −29%".
function priceMove(current: number | null, prev: number | null): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (!current || !prev) return null
  const pct   = (current - prev) / prev
  const tone  = pct <= -0.10 ? 'down' : pct >= 0.10 ? 'up' : 'flat'
  const arrow = pct <= -0.005 ? '▼' : pct >= 0.005 ? '▲' : '＝'
  const sign  = pct > 0 ? '+' : ''
  return { text: `${arrow} was ${fmt(prev)} · ${sign}${Math.round(pct * 100)}%`, tone }
}

// Colour a price advisory by its wording: dear (above avg/max) = red, cheap
// (below / cheaper / bargain) = green, "at the max" / mixed = amber.
function tipToneClass(tip: string): string {
  const t = tip.toLowerCase()
  const cheap = /cheaper|\bbelow\b|bargain/.test(t)
  const dear  = /\babove\b|over the max|exceeds/.test(t)
  if (cheap && !dear) return 'text-green-700'
  if (dear && !cheap) return 'text-red-600'
  return 'text-amber-600'
}

// ── RRP calculation ───────────────────────────────────────────────────────────



// ── Row state ─────────────────────────────────────────────────────────────────

type RowState = {
  qty:          number
  pricePounds:  string
  countPerBox:  number        // actual pieces/units in the box (may differ from CONFIG default)
  supplier:     'dole' | 'holland'
  status:       'green' | 'amber' | 'red' | null
  saving:       boolean
}

// All products use two entries: `${productId}:0` = Dole, `${productId}:1` = JR Holland

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  session:             MarketSession
  products:            MarketProduct[]
  existingItems:       MarketSessionItem[]
  supplierIds:         SupplierIds
  briefing?:           string | null
  runMode?:            boolean
  requiredProductIds?: string[]  // market-run: product IDs with orders — shown by default
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketBuyClient({ session, products, existingItems, supplierIds, briefing, runMode, requiredProductIds }: Props) {
  const requiredSet = useMemo(() => new Set(requiredProductIds ?? []), [requiredProductIds])

  const defaultCountPerBox = (p: MarketProduct): number => {
    const cfg = CONFIG[p.name]
    if (!cfg) return 1
    if (p.caseSize > 1) return p.caseSize
    if (cfg.unitType === 'count') return cfg.typicalBoxCount
    if (cfg.retailUnitsPerBox) return cfg.retailUnitsPerBox
    return cfg.typicalBoxCount
  }

  const initRows = (): Map<string, RowState> => {
    const m = new Map<string, RowState>()

    // Index existing items by product_id:entry_index (handles any number of batches)
    const byEntry = new Map<string, MarketSessionItem>()
    for (const item of existingItems) byEntry.set(`${item.product_id}:${item.entry_index}`, item)

    // Number of batches already saved per section — need rows up to this point
    const maxBatch = Math.max(
      session.roots_batches,
      session.veg_batches,
      session.fruit_batches,
    )

    for (const p of products) {
      // Default the order quantity to the CHEAPER supplier by last price.
      // Only fall back to the configured preference when prices can't decide.
      const dpLast = p.doleLastPricePence
      const hpLast = p.hollandLastPricePence
      const preferredIsHolland =
        dpLast != null && hpLast != null ? hpLast < dpLast
        : hpLast != null                 ? true
        : dpLast != null                 ? false
        : CONFIG[p.name]?.preferredSupplier === 'holland'
      const ws = p.wholesaleQtyBoxes ?? 0

      for (let batch = 0; batch <= maxBatch; batch++) {
        const dIdx = batch * 2      // Dole entry index for this batch
        const hIdx = batch * 2 + 1  // Holland entry index for this batch

        const dItem = byEntry.get(`${p.id}:${dIdx}`)
        const hItem = byEntry.get(`${p.id}:${hIdx}`)

        const defCount = defaultCountPerBox(p)

        m.set(`${p.id}:${dIdx}`, dItem ? {
          qty: dItem.qty_boxes,
          pricePounds: dItem.price_pence ? (dItem.price_pence / 100).toFixed(2) : '',
          countPerBox: dItem.units_per_case ?? defCount,
          supplier: 'dole', status: dItem.deal_status as RowState['status'], saving: false,
        } : {
          qty: batch === 0 && !preferredIsHolland ? ws : 0,
          pricePounds: p.doleLastPricePence ? (p.doleLastPricePence / 100).toFixed(2) : '',
          countPerBox: defCount,
          supplier: 'dole',
          status: moveStatus(p.doleLastPricePence, p.dolePrevPricePence),
          saving: false,
        })

        m.set(`${p.id}:${hIdx}`, hItem ? {
          qty: hItem.qty_boxes,
          pricePounds: hItem.price_pence ? (hItem.price_pence / 100).toFixed(2) : '',
          countPerBox: hItem.units_per_case ?? defCount,
          supplier: 'holland', status: hItem.deal_status as RowState['status'], saving: false,
        } : {
          qty: batch === 0 && preferredIsHolland ? ws : 0,
          pricePounds: p.hollandLastPricePence ? (p.hollandLastPricePence / 100).toFixed(2) : '',
          countPerBox: defCount,
          supplier: 'holland',
          status: moveStatus(p.hollandLastPricePence, p.hollandPrevPricePence),
          saving: false,
        })
      }
    }
    return m
  }

  const existingProductIds = new Set(existingItems.map(i => i.product_id))

  const [rows, setRows]               = useState<Map<string, RowState>>(initRows)
  const [activeTab, setActiveTab]     = useState<'veg' | 'fruit'>('veg')
  const [collapsed, setCollapsed]     = useState<Set<string>>(() => new Set())
  const [activeRare, setActiveRare]   = useState<Set<string>>(() => new Set())
  const [removed, setRemoved]         = useState<Set<string>>(() => new Set())
  const [showAdd, setShowAdd]         = useState<string | null>(null)
  const [justAdded, setJustAdded]     = useState<string | null>(null)
  const [confirmReset, setConfirmReset]   = useState(false)
  const [showSummary, setShowSummary]     = useState(session.status === 'closed')
  const [showBriefing, setShowBriefing]   = useState(true)
  const [closing, setClosing]           = useState(false)
  // How many batches completed per section (0 = not started)
  const [batchesDone, setBatchesDone] = useState({
    roots: session.roots_batches,
    veg:   session.veg_batches,
    fruit: session.fruit_batches,
  })
  // Whether there is currently an open (in-progress) batch per section
  const [batchActive, setBatchActive] = useState({
    roots: session.roots_batches === 0,
    veg:   session.veg_batches   === 0,
    fruit: session.fruit_batches === 0,
  })
  const [sectionSaving, setSectionSaving] = useState<'roots' | 'veg' | 'fruit' | null>(null)

  const toggleCollapsed = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Shift balance: if unfulfilled wholesale order remains, add remainder to other side.
  // If already fulfilled (or no order), swap quantities between the two suppliers.
  const shiftBalance = useCallback((productId: string, wholesaleQtyBoxes: number, batchNumber = 0) => {
    const dKey = `${productId}:${batchNumber * 2}`
    const hKey = `${productId}:${batchNumber * 2 + 1}`
    setRows(prev => {
      const n = new Map(prev)
      const dRow = n.get(dKey)
      const hRow = n.get(hKey)
      if (!dRow || !hRow) return prev

      const totalFilled = dRow.qty + hRow.qty
      const remaining   = Math.max(0, wholesaleQtyBoxes - totalFilled)

      if (remaining > 0) {
        // Add unfulfilled remainder to whichever side currently has less
        if (hRow.qty >= dRow.qty) {
          n.set(dKey, { ...dRow, qty: dRow.qty + remaining })
        } else {
          n.set(hKey, { ...hRow, qty: hRow.qty + remaining })
        }
      } else {
        // Fully covered — swap so David can try the other supplier
        n.set(dKey, { ...dRow, qty: hRow.qty })
        n.set(hKey, { ...hRow, qty: dRow.qty })
      }
      return n
    })
  }, [])
  const saveTimers                  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const isVisible = (p: MarketProduct) => {
    if (runMode) {
      if (requiredSet.has(p.id)) return true
      if (removed.has(p.id)) return false
      return existingProductIds.has(p.id) || activeRare.has(p.id)
    }
    if (removed.has(p.id)) return false
    if (!CONFIG[p.name]?.rareBuy) return true
    if (existingProductIds.has(p.id)) return true
    return activeRare.has(p.id)
  }

  const schedSave = useCallback((productId: string, entryIndex: number, row: RowState) => {
    const key = `${productId}:${entryIndex}`
    const t = saveTimers.current.get(key)
    if (t) clearTimeout(t)
    saveTimers.current.set(key, setTimeout(async () => {
      const pricePence = Math.round(parseFloat(row.pricePounds) * 100)
      if (!pricePence || isNaN(pricePence) || row.qty === 0) return
      setRows(prev => { const n = new Map(prev); const c = n.get(key); if (c) n.set(key, { ...c, saving: true }); return n })
      try {
        await upsertMarketItem({
          sessionId:    session.id,
          productId,
          entryIndex,
          supplierId:   row.supplier === 'dole' ? supplierIds.dole : supplierIds.holland,
          qtyBoxes:     row.qty,
          pricePence,
          dealStatus:   row.status,
          unitsPerCase: row.countPerBox,
        })
      } finally {
        setRows(prev => { const n = new Map(prev); const c = n.get(key); if (c) n.set(key, { ...c, saving: false }); return n })
      }
    }, 800))
  }, [session.id, supplierIds])

  // Remove a mistakenly-added item: cancel pending saves so they can't resurrect
  // it, zero its qty locally (so totals exclude it), hide the card, and delete it.
  const removeProduct = useCallback((productId: string) => {
    for (const [k, t] of saveTimers.current) {
      if (k.startsWith(`${productId}:`)) { clearTimeout(t); saveTimers.current.delete(k) }
    }
    setRows(prev => {
      const n = new Map(prev)
      for (const [k, r] of n) if (k.startsWith(`${productId}:`)) n.set(k, { ...r, qty: 0 })
      return n
    })
    setActiveRare(prev => { const n = new Set(prev); n.delete(productId); return n })
    setRemoved(prev => new Set(prev).add(productId))
    deleteMarketProduct({ sessionId: session.id, productId }).catch(() => {})
  }, [session.id])

  const update = useCallback((productId: string, entryIndex: number, patch: Partial<Omit<RowState, 'supplier'>>, product: MarketProduct) => {
    setRows(prev => {
      const next    = new Map(prev)
      const key     = `${productId}:${entryIndex}`
      const current = next.get(key)
      if (!current) return prev
      const updated = { ...current, ...patch }
      if ('pricePounds' in patch) {
        const pp   = Math.round(parseFloat(updated.pricePounds) * 100)
        const prev = current.supplier === 'holland' ? product.hollandPrevPricePence : product.dolePrevPricePence
        updated.status = pp > 0 ? moveStatus(pp, prev) : null
      }
      next.set(key, updated)
      schedSave(productId, entryIndex, updated)
      return next
    })
  }, [schedSave])

  const veg   = products.filter(p => p.category === 'veg')
  const fruit = products.filter(p => p.category === 'fruit')

  // Roots & onions are now a DATA property (products.market_section), not a hardcoded
  // name list — so any new root veg David adds lands in the right section automatically.
  const isRoot = (p: MarketProduct) => p.marketSection === 'roots'

  const vegRoots     = veg.filter(p => isRoot(p) && isVisible(p))
  const vegOther     = veg.filter(p => !isRoot(p) && isVisible(p))
  const rareVegRoots = veg.filter(p => isRoot(p) && !isVisible(p) && (runMode || CONFIG[p.name]?.rareBuy))
  const rareVegOther = veg.filter(p => !isRoot(p) && !isVisible(p) && (runMode || CONFIG[p.name]?.rareBuy))
  const visFruit       = fruit.filter(isVisible)
  const rareFruit      = fruit.filter(p => !isVisible(p) && (runMode || CONFIG[p.name]?.rareBuy))

  const handleSectionDone = async (section: 'roots' | 'veg' | 'fruit') => {
    setSectionSaving(section)
    const newCount = batchesDone[section] + 1
    await completeSectionBatch(session.id, section, newCount)
    setBatchesDone(prev => ({ ...prev, [section]: newCount }))
    setBatchActive(prev => ({ ...prev, [section]: false }))
    setSectionSaving(null)
  }

  // Undo the most recent "Order placed" for a section: drop the batch counter
  // and re-activate the form. The batch's rows are still in state, so the saved
  // quantities/prices reappear for editing.
  const handleSectionReopen = async (section: 'roots' | 'veg' | 'fruit') => {
    const newCount = batchesDone[section] - 1
    if (newCount < 0) return
    setSectionSaving(section)
    await reopenSectionBatch(session.id, section, newCount)
    setBatchesDone(prev => ({ ...prev, [section]: newCount }))
    setBatchActive(prev => ({ ...prev, [section]: true }))
    setSectionSaving(null)
  }

  const startUrgentBatch = (section: 'roots' | 'veg' | 'fruit', sectionProducts: MarketProduct[]) => {
    const newBatch = batchesDone[section]
    setRows(prev => {
      const n = new Map(prev)
      for (const p of sectionProducts) {
        const dIdx = newBatch * 2
        const hIdx = newBatch * 2 + 1
        const preferredIsHolland = CONFIG[p.name]?.preferredSupplier === 'holland'
        const cfg2 = CONFIG[p.name]
        const defC = !cfg2 ? 1 : p.caseSize > 1 ? p.caseSize : cfg2.unitType === 'count' ? cfg2.typicalBoxCount : cfg2.retailUnitsPerBox ?? cfg2.typicalBoxCount
        n.set(`${p.id}:${dIdx}`, {
          qty: 0, countPerBox: defC,
          pricePounds: p.doleLastPricePence ? (p.doleLastPricePence / 100).toFixed(2) : '',
          supplier: 'dole',
          status: moveStatus(p.doleLastPricePence, p.dolePrevPricePence),
          saving: false,
        })
        n.set(`${p.id}:${hIdx}`, {
          qty: 0, countPerBox: defC,
          pricePounds: p.hollandLastPricePence ? (p.hollandLastPricePence / 100).toFixed(2) : '',
          supplier: 'holland',
          status: moveStatus(p.hollandLastPricePence, p.hollandPrevPricePence),
          saving: false,
        })
      }
      return n
    })
    setBatchActive(prev => ({ ...prev, [section]: true }))
  }

  const allSectionsDone = batchesDone.roots > 0 && batchesDone.veg > 0 && batchesDone.fruit > 0

  const handleDone = async () => {
    setClosing(true)
    await closeMarketSession(session.id)
    setClosing(false)
    setShowSummary(true)
  }

  const summaryLines = useMemo(() => {
    const dole: SummaryLine[] = []
    const holland: SummaryLine[] = []
    const maxBatch = Math.max(batchesDone.roots, batchesDone.veg, batchesDone.fruit)
    for (const p of products) {
      for (let batch = 0; batch <= maxBatch; batch++) {
        const dRow = rows.get(`${p.id}:${batch * 2}`)
        const hRow = rows.get(`${p.id}:${batch * 2 + 1}`)
        if (dRow && dRow.qty > 0) {
          const pp = Math.round(parseFloat(dRow.pricePounds) * 100)
          if (pp > 0) {
            const ex = dole.find(l => l.name === p.name)
            if (ex) ex.qty += dRow.qty
            else dole.push({ name: p.name, qty: dRow.qty, pricePence: pp })
          }
        }
        if (hRow && hRow.qty > 0) {
          const pp = Math.round(parseFloat(hRow.pricePounds) * 100)
          if (pp > 0) {
            const ex = holland.find(l => l.name === p.name)
            if (ex) ex.qty += hRow.qty
            else holland.push({ name: p.name, qty: hRow.qty, pricePence: pp })
          }
        }
      }
    }
    return { dole, holland }
  }, [rows, products, batchesDone])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  // ── Running total ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let spend = 0, revenue = 0, totalBoxes = 0, hasEstimate = false
    const bargainSet   = new Set<string>()

    for (const [key, row] of rows) {
      if (row.qty === 0) continue
      const pp = Math.round(parseFloat(row.pricePounds) * 100)
      if (!pp) continue

      totalBoxes += row.qty
      const productId = key.split(':')[0]
      const product   = products.find(p => p.id === productId)
      if (!product) continue
      const cfg = CONFIG[product.name]
      if (!cfg) continue

      const boxSpend = row.qty * pp
      spend += boxSpend

      // Revenue: use actual count per box from row (user may have overridden the default)
      const unitsPerBox: number | null =
        product.caseSize > 1 ? product.caseSize
        : (cfg.unitType === 'count' || cfg.retailUnitsPerBox) ? row.countPerBox
        : null

      if (unitsPerBox && product.retailPricePence > 0) {
        revenue += row.qty * unitsPerBox * product.retailPricePence
      } else {
        revenue += boxSpend * product.priceMultiplier
        hasEstimate = true
      }

      if (row.status === 'green') bargainSet.add(product.name)
    }

    if (spend === 0) return null

    const profit = revenue - spend
    const margin = revenue > 0 ? profit / revenue : 0

    return { spend, revenue, profit, margin, totalBoxes, bargains: [...bargainSet].sort(), hasEstimate }
  }, [rows, products])

  const renderSubSection = (
    sectionKey: 'roots' | 'veg' | 'fruit',
    collapseKey: string,
    label: string,
    visItems: MarketProduct[],
    rareItems: MarketProduct[],
  ) => {
    const doneBatches  = batchesDone[sectionKey]
    const isActive     = batchActive[sectionKey]
    const activeBatch  = doneBatches   // active batch index = number of completed batches
    const saving       = sectionSaving === sectionKey

    const lockedSummary = (batchIdx: number) => {
      const ordered = visItems.flatMap(p => {
        const dRow = rows.get(`${p.id}:${batchIdx * 2}`)
        const hRow = rows.get(`${p.id}:${batchIdx * 2 + 1}`)
        const lines: string[] = []
        if (dRow && dRow.qty > 0) lines.push(`${p.name} ×${dRow.qty} Dole`)
        if (hRow && hRow.qty > 0) lines.push(`${p.name} ×${hRow.qty} Holland`)
        return lines
      })
      return (
        <div key={batchIdx} className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-green-500">✓</span>{' '}
              {batchIdx === 0 ? label : `${label} — Urgent`}
            </h3>
            <div className="flex items-center gap-2">
              {batchIdx === doneBatches - 1 && !isActive && session.status === 'open' && (
                <button
                  onClick={() => handleSectionReopen(sectionKey)}
                  disabled={saving}
                  className="text-[10px] text-blue-600 font-semibold disabled:opacity-40">
                  {saving ? 'Reopening…' : 'Reopen'}
                </button>
              )}
              <span className="text-[10px] text-green-600 font-semibold">Order placed</span>
            </div>
          </div>
          <div className="border border-green-200 rounded-xl px-3 py-2.5 bg-green-50">
            {ordered.length > 0
              ? <p className="text-xs text-gray-600 leading-relaxed">{ordered.join(' · ')}</p>
              : <p className="text-xs text-gray-400 italic">Nothing ordered</p>}
          </div>
        </div>
      )
    }

    return (
      <div className="mb-4">
        {/* Locked summaries for all completed batches */}
        {Array.from({ length: doneBatches }, (_, i) => lockedSummary(i))}

        {/* Active input form */}
        {isActive && (
          <>
            <button className="w-full flex items-center justify-between mb-2"
              onClick={() => toggleCollapsed(collapseKey)}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {activeBatch === 0 ? label : `${label} — Urgent`}{' '}
                <span className="font-normal text-gray-400">({visItems.length})</span>
              </h3>
              <span className="text-xs text-gray-400">{collapsed.has(collapseKey) ? 'show' : 'hide'}</span>
            </button>

            {!collapsed.has(collapseKey) && (
              <div className="space-y-2">
                {visItems.map(p => (
                  <ProductCard
                    key={`${p.id}-b${activeBatch}`}
                    product={p}
                    batchNumber={activeBatch}
                    doleRow={rows.get(`${p.id}:${activeBatch * 2}`)!}
                    hollandRow={rows.get(`${p.id}:${activeBatch * 2 + 1}`)!}
                    onUpdate={update}
                    onShiftBalance={shiftBalance}
                    isNew={justAdded === p.id}
                    onScrolled={() => setJustAdded(null)}
                    onRemove={!requiredSet.has(p.id) ? () => removeProduct(p.id) : undefined}
                  />
                ))}

                {activeBatch === 0 && rareItems.length > 0 && (
                  <div className="pt-1">
                    {showAdd === collapseKey ? (
                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        {rareItems.map(p => (
                          <button key={p.id}
                            onClick={() => { setActiveRare(prev => new Set([...prev, p.id])); setShowAdd(null); setJustAdded(p.id) }}
                            className="w-full text-left px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 last:border-0 active:bg-gray-50 flex items-baseline gap-2">
                            <span>{p.name}</span>
                            {p.tip && <span className={`text-[10px] truncate ${tipToneClass(p.tip)}`}>{p.tip}</span>}
                          </button>
                        ))}
                        <button onClick={() => setShowAdd(null)}
                          className="w-full px-3 py-2 text-xs text-center text-gray-400 border-t border-gray-100">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowAdd(collapseKey)}
                        className="text-xs text-blue-600 py-1">+ add item</button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleSectionDone(sectionKey)}
                  disabled={saving || session.status === 'closed'}
                  className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white active:bg-gray-700 disabled:opacity-40">
                  {saving ? 'Saving…' : activeBatch === 0 ? `Done — ${label} order placed` : 'Done — urgent order placed'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Urgent order button — only when all batches locked and session still open */}
        {!isActive && doneBatches > 0 && session.status === 'open' && (
          <button
            onClick={() => startUrgentBatch(sectionKey, visItems)}
            className="text-xs text-blue-600 py-1 mt-1">
            + Urgent order for {label.toLowerCase()}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 bg-white text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <Link href="/dashboard" aria-label="Back to home"
                className="text-gray-900 min-h-[48px] min-w-[48px] flex items-center justify-center text-xl -ml-2">←</Link>
          <div>
          <h1 className="text-xl font-bold text-gray-900">{runMode ? 'Market Run' : 'Market Buy'}</h1>
          <p className="text-xs text-gray-500">
            {today}{session.trip_number > 1 ? ` · Purchase ${session.trip_number}` : ''} · {session.status === 'open' ? 'Session open' : 'Session closed'}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary && <p className="text-sm font-bold text-gray-900">{summary.totalBoxes} boxes</p>}
          {session.status === 'closed' && (
            <button
              onClick={async () => { await startNewTrip() }}
              className="text-xs font-semibold text-white bg-gray-900 px-3 py-1.5 rounded-lg active:bg-gray-700">
              New purchase
            </button>
          )}
          {summary && session.status === 'open' && !confirmReset && (
            <button onClick={() => setConfirmReset(true)} className="text-xs text-gray-400 active:text-red-500">Reset</button>
          )}
          {confirmReset && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Reset all?</span>
              <button onClick={() => { setRows(prev => { const n = new Map(prev); for (const [k, r] of n) n.set(k, { ...r, qty: 0 }); return n }); setConfirmReset(false) }}
                className="text-xs font-semibold text-red-600 px-2 py-1 rounded border border-red-200 active:bg-red-50">Yes</button>
              <button onClick={() => setConfirmReset(false)}
                className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 active:bg-gray-50">No</button>
            </div>
          )}
        </div>
      </div>

      {/* Market Golem briefing */}
      {briefing && showBriefing && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 flex gap-2 items-start">
          <span className="text-[10px] font-bold text-green-700 mt-0.5 shrink-0">AI</span>
          <p className="text-xs text-green-900 flex-1 leading-relaxed">{briefing}</p>
          <button onClick={() => setShowBriefing(false)} className="text-green-600 text-xs shrink-0 mt-0.5">✕</button>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &gt;10% below avg</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> within 10%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;10% above</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button onClick={() => setActiveTab('veg')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'veg'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400'
          }`}>
          🥦 Vegetables
        </button>
        <button onClick={() => setActiveTab('fruit')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'fruit'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-400'
          }`}>
          🍎 Fruit
        </button>
      </div>

      {activeTab === 'veg' && (
        <>
          {renderSubSection('roots', 'vegRoots', 'Roots & Onions', vegRoots, rareVegRoots)}
          <div className="border-t border-gray-100 mb-4" />
          {renderSubSection('veg', 'vegOther', 'Vegetables', vegOther, rareVegOther)}
        </>
      )}

      {/* Fruit tab */}
      {activeTab === 'fruit' && renderSubSection('fruit', 'fruit', 'All fruit', visFruit, rareFruit)}

      {/* Finish panel — appears once all sections done */}
      {allSectionsDone && session.status === 'open' && (
        <div className="mt-2 mb-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900 mb-0.5">
            {runMode ? 'Ready to commit' : 'All orders placed'}
          </p>
          {runMode ? (() => {
            const shortfalls = products.filter(p => {
              if (!requiredSet.has(p.id) || p.wholesaleQtyBoxes <= 0) return false
              let total = 0
              for (let batch = 0; batch <= Math.max(batchesDone.roots, batchesDone.veg, batchesDone.fruit); batch++) {
                total += (rows.get(`${p.id}:${batch * 2}`)?.qty ?? 0) + (rows.get(`${p.id}:${batch * 2 + 1}`)?.qty ?? 0)
              }
              return total < p.wholesaleQtyBoxes
            })
            return shortfalls.length > 0 ? (
              <div className="mb-3 border border-amber-300 rounded-lg bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Shortfall — allocate before committing:</p>
                {shortfalls.map(p => {
                  let got = 0
                  for (let b = 0; b <= Math.max(batchesDone.roots, batchesDone.veg, batchesDone.fruit); b++) {
                    got += (rows.get(`${p.id}:${b * 2}`)?.qty ?? 0) + (rows.get(`${p.id}:${b * 2 + 1}`)?.qty ?? 0)
                  }
                  return (
                    <p key={p.id} className="text-xs text-amber-700">
                      {p.name}: need {p.wholesaleQtyBoxes} box{p.wholesaleQtyBoxes !== 1 ? 'es' : ''}, ordered {got}
                    </p>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mb-3">All orders covered — tap to see your Dole and Holland lists.</p>
            )
          })() : (
            <p className="text-xs text-gray-500 mb-3">
              Back at the van? You can scan your invoices to check for any discrepancies before closing.
            </p>
          )}
          <div className="flex gap-2">
            {!runMode && (
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-400 bg-white disabled:cursor-not-allowed">
                📷 Scan invoices
              </button>
            )}
            <button
              onClick={handleDone}
              disabled={closing}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white active:bg-gray-700 disabled:opacity-50">
              {closing ? '…' : runMode ? 'Commit & view order →' : 'Close & share →'}
            </button>
          </div>
        </div>
      )}

      {/* Sticky running total — sits above the NavBar (h-16 = 4rem) */}
      {summary && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="max-w-lg mx-auto">
            <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 shadow-xl">

              {/* Numbers row */}
              <div className="flex items-end justify-between gap-2 mb-1">
                <div className="text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Spend</p>
                  <p className="text-sm font-bold text-white">{fmt(summary.spend)}</p>
                </div>
                <p className="text-gray-600 text-xs mb-1">→</p>
                <div className="text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Revenue</p>
                  <p className="text-sm font-bold text-white">{fmt(summary.revenue)}</p>
                </div>
                <p className="text-gray-600 text-xs mb-1">=</p>
                <div className="text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Profit</p>
                  <p className={`text-sm font-bold ${summary.margin >= 0.20 ? 'text-green-400' : summary.margin < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {fmt(summary.profit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Margin</p>
                  <p className={`text-lg font-bold leading-none ${summary.margin >= 0.20 ? 'text-green-400' : summary.margin < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {Math.round(summary.margin * 100)}%
                  </p>
                </div>
              </div>

              {/* Estimate caveat */}
              {summary.hasEstimate && (
                <p className="text-[9px] text-gray-600 mt-1">* weight items estimated at standard markup</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary overlay */}
      {showSummary && (
        <SessionSummary
          date={today}
          lines={summaryLines}
          financials={summary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}

// ── Session summary overlay ───────────────────────────────────────────────────

type SummaryLine = { name: string; qty: number; pricePence: number }

function SessionSummary({ date, lines, financials, onClose }: {
  date:       string
  lines:      { dole: SummaryLine[]; holland: SummaryLine[] }
  financials: { spend: number; revenue: number; profit: number; margin: number; bargains: string[]; hasEstimate: boolean } | null
  onClose:    () => void
}) {
  const doleTotal    = lines.dole.reduce((s, l) => s + l.qty * l.pricePence, 0)
  const hollandTotal = lines.holland.reduce((s, l) => s + l.qty * l.pricePence, 0)
  const grandTotal   = doleTotal + hollandTotal

  const buildShareText = () => {
    // Right-justify amounts into a column. Wrapped in ``` so WhatsApp renders it
    // monospace — otherwise proportional fonts make the padding look ragged.
    const WIDTH = 30
    const row = (left: string, right: string) => {
      const gap = Math.max(1, WIDTH - left.length - right.length)
      return left + ' '.repeat(gap) + right
    }
    const out: string[] = [`🍋 Fresh & Fruity — Market Buy ${date}`, '']
    const addSection = (label: string, items: SummaryLine[], total: number) => {
      if (!items.length) return
      out.push('```')
      out.push(label.toUpperCase())
      for (const l of items)
        out.push(row(`${l.name} ×${l.qty}`, fmt(l.qty * l.pricePence)))
      out.push(row(`${label} total`, fmt(total)))
      out.push('```')
      out.push('')
    }
    addSection('Dole', lines.dole, doleTotal)
    addSection('JR Holland', lines.holland, hollandTotal)
    out.push(`*GRAND TOTAL — ${fmt(grandTotal)}*`)
    return out.join('\n')
  }

  const handleShare = async () => {
    const text = buildShareText()
    if (navigator.share) {
      try { await navigator.share({ title: `Market Buy ${date}`, text }); return } catch {}
    }
    // clipboard.writeText needs HTTPS — fall back to execCommand on plain HTTP
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard — paste into WhatsApp or Notes')
      return
    } catch {}
    // execCommand fallback (works on HTTP)
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
      alert('Copied to clipboard — paste into WhatsApp or Notes')
    } catch {
      // last resort: show in a prompt so user can long-press copy
      window.prompt('Select all and copy:', text)
    } finally {
      document.body.removeChild(el)
    }
  }

  const SupplierSection = ({ label, items, total }: { label: string; items: SummaryLine[]; total: number }) => {
    if (!items.length) return null
    return (
      <div className="mb-5">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{label}</h3>
        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
          {items.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between px-3 py-2 border-b border-[var(--border)] last:border-0 bg-[var(--bg-card)]">
              <span className="text-sm text-[var(--text)] flex-1">{l.name}</span>
              <span className="text-xs text-[var(--text-muted)] mx-2 shrink-0">{l.qty} × {fmt(l.pricePence)}</span>
              <span className="text-sm font-semibold text-[var(--text)] shrink-0">{fmt(l.qty * l.pricePence)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-black/5">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{label} total</span>
            <span className="text-sm font-bold text-[var(--text)]">{fmt(total)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto pb-28">
      <div className="max-w-lg mx-auto">
        <div className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--text)]">Market Summary</h2>
            <p className="text-xs text-[var(--text-muted)]">{date}</p>
          </div>
          <button onClick={onClose} className="text-xs text-[var(--text-muted)] border border-[var(--border)] px-3 py-1.5 rounded-lg active:bg-black/5">
            Edit
          </button>
        </div>

        <div className="px-4 pt-4">

          {/* ── Financial overview ─────────────────────────────────────────── */}
          {financials && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center px-2 py-3 bg-[var(--bg-card)] rounded-xl">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Spend</p>
                  <p className="text-sm font-bold text-[var(--text)]">{fmt(financials.spend)}</p>
                </div>
                <div className="text-center px-2 py-3 bg-[var(--bg-card)] rounded-xl">
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Profit est.</p>
                  <p className={`text-sm font-bold ${financials.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(financials.profit)}
                  </p>
                </div>
                <div className={`text-center px-2 py-3 rounded-xl ${financials.margin >= 0.30 ? 'bg-green-900/40' : financials.margin >= 0.20 ? 'bg-amber-900/40' : 'bg-red-900/40'}`}>
                  <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Margin</p>
                  <p className={`text-xl font-bold leading-none ${financials.margin >= 0.30 ? 'text-green-400' : financials.margin >= 0.20 ? 'text-amber-400' : 'text-red-400'}`}>
                    {Math.round(financials.margin * 100)}%
                  </p>
                </div>
              </div>
              {financials.hasEstimate && (
                <p className="text-[9px] text-[var(--text-muted)] -mt-2 mb-3 text-center">* profit estimated — some items priced at standard markup</p>
              )}


              {/* Bargains */}
              {financials.bargains.length > 0 && (
                <div className="mb-4 border border-green-800 rounded-xl p-3 bg-green-900/30">
                  <p className="text-xs font-bold text-green-300 mb-1">🎯 Bargains today</p>
                  <p className="text-xs text-green-300">{financials.bargains.join(' · ')}</p>
                </div>
              )}
            </>
          )}

          <SupplierSection label="Dole" items={lines.dole} total={doleTotal} />
          <SupplierSection label="JR Holland" items={lines.holland} total={hollandTotal} />

          <div className="flex justify-between items-center px-3 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl mb-6">
            <span className="text-sm font-bold text-[var(--text)]">Grand total</span>
            <span className="text-lg font-bold text-[var(--text)]">{fmt(grandTotal)}</span>
          </div>

          <button onClick={handleShare}
            className="w-full py-3 bg-brand-accent text-white font-semibold rounded-xl active:opacity-80 text-sm">
            Share summary
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const DOT: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`

// Format a per-unit cost: use pence if under £1, pounds if £1+


// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ product, doleRow, hollandRow, onUpdate, onShiftBalance, isNew, onScrolled, batchNumber = 0, onRemove }: {
  product:          MarketProduct
  doleRow:          RowState
  hollandRow:       RowState
  onUpdate:         (id: string, idx: number, patch: Partial<Omit<RowState, 'supplier'>>, p: MarketProduct) => void
  onShiftBalance:   (productId: string, wholesaleQtyBoxes: number, batchNumber: number) => void
  isNew?:           boolean
  onScrolled?:      () => void
  batchNumber?:     number
  onRemove?:        () => void
}) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => {
    if (isNew && cardRef.current) {
      const t = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        onScrolled?.()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [isNew, onScrolled])

  const config    = CONFIG[product.name]!
  const defaultCount = product.caseSize > 1 ? product.caseSize
    : config.unitType === 'count' ? config.typicalBoxCount
    : config.retailUnitsPerBox ?? config.typicalBoxCount
  const anyBought = doleRow.qty > 0 || hollandRow.qty > 0
  const anySaving = doleRow.saving || hollandRow.saving

  const dp = Math.round(parseFloat(doleRow.pricePounds) * 100) || 0
  const hp = Math.round(parseFloat(hollandRow.pricePounds) * 100) || 0
  const doleRec    = dp > 0 && hp > 0 ? dp <= hp : dp > 0
  const hollandRec = dp > 0 && hp > 0 ? hp < dp  : hp > 0
  const leadStatus = doleRec ? doleRow.status : hollandRec ? hollandRow.status : null


  return (
    <div ref={cardRef} className={`border rounded-xl p-3 bg-white ${anyBought ? 'border-gray-900' : 'border-gray-200'}`}>
      {/* Name + ref inline, tip below */}
      <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 self-center transition-colors ${leadStatus ? DOT[leadStatus] : 'bg-gray-200'}`} />
        <span className="font-semibold text-gray-900 text-sm">{product.name}</span>
        {anySaving && <span className="text-[9px] text-gray-400 ml-auto">saving…</span>}
        {onRemove && (
          <button onClick={onRemove} aria-label={`Remove ${product.name}`}
            className={`${anySaving ? '' : 'ml-auto'} -my-1 w-6 h-6 rounded-md text-gray-300 active:text-red-600 flex items-center justify-center text-sm leading-none shrink-0`}>✕</button>
        )}
      </div>
      {product.tip && (
        <p className={`text-[10px] mb-2 pl-4 ${tipToneClass(product.tip)}`}>{product.tip}</p>
      )}
      {product.bestSupplier && (
        <p className="text-[10px] mb-2 pl-4 font-medium text-emerald-700">🏆 {product.bestSupplier.text}</p>
      )}

      {/* Two supplier columns with shift button in between */}
      <div className="flex items-start gap-1">
        <SupplierColumn
          label="Dole"
          lastPrice={product.doleLastPricePence}
          lastDate={product.doleLastDate}
          prevPrice={product.dolePrevPricePence}
          row={doleRow}
          product={product}
          isRecommended={doleRec}
          defaultCount={defaultCount}
          onUpdate={patch => onUpdate(product.id, batchNumber * 2, patch, product)}
        />

        {/* Shift balance button */}
        <div className="flex flex-col items-center justify-center pt-12 shrink-0">
          <button
            onClick={() => onShiftBalance(product.id, product.wholesaleQtyBoxes, batchNumber)}
            className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-500 flex items-center justify-center active:bg-gray-100 text-base leading-none"
            title="Shift balance to other supplier">
            ⇄
          </button>
        </div>

        <SupplierColumn
          label="JR Holland"
          lastPrice={product.hollandLastPricePence}
          lastDate={product.hollandLastDate}
          prevPrice={product.hollandPrevPricePence}
          row={hollandRow}
          product={product}
          isRecommended={hollandRec}
          defaultCount={defaultCount}
          onUpdate={patch => onUpdate(product.id, batchNumber * 2 + 1, patch, product)}
        />
      </div>

      {/* Wholesale order indicator with breakdown bubble */}
      {product.wholesaleQtyBoxes > 0 && (
        <div className="relative mt-1.5">
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="text-[10px] text-blue-600 flex items-center gap-1">
            📦 Wholesale orders need{' '}
            <span className="underline underline-offset-2 font-semibold">
              {product.wholesaleQtyBoxes} box{product.wholesaleQtyBoxes !== 1 ? 'es' : ''}
            </span>
          </button>
          {showBreakdown && product.wholesaleBreakdown.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 min-w-[160px]">
              {product.wholesaleBreakdown.map((b, i) => (
                <p key={i} className="text-xs text-gray-800 py-0.5">
                  <span className="font-medium">{b.customerName}</span>{' '}
                  {[b.boxes > 0 ? `${b.boxes} box` : '', b.units > 0 ? `${b.units} loose` : ''].filter(Boolean).join(' + ') || '0'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Supplier column ───────────────────────────────────────────────────────────

// ── Golem inline advice ───────────────────────────────────────────────────────

type GolemAdvice = { text: string; tone: 'warn' | 'good' | 'info' }

const MONTHS: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const [d, m] = dateStr.split(' ')
  if (!d || !m || MONTHS[m] === undefined) return null
  const now  = new Date()
  const date = new Date(now.getFullYear(), MONTHS[m], parseInt(d))
  if (date > now) date.setFullYear(now.getFullYear() - 1)
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}


function SupplierColumn({ label, lastPrice, lastDate, prevPrice, row, product, isRecommended, defaultCount, onUpdate }: {
  label:         string
  lastPrice:     number | null
  lastDate:      string | null
  prevPrice:     number | null   // this supplier's previous box price (the buy before last)
  row:           RowState
  product:       MarketProduct
  isRecommended: boolean
  defaultCount:  number
  onUpdate:      (patch: Partial<Omit<RowState, 'supplier'>>) => void
}) {
  const cfg          = CONFIG[product.name]
  const showCount    = cfg && cfg.unitType === 'count'   // pieces only (for ordering qty, not pricing)
  const countChanged = row.countPerBox !== defaultCount

  const entered = Math.round(parseFloat(row.pricePounds) * 100) || 0
  // Up or down vs the buy before? Compare the typed price (or last bought, if not
  // typed yet) against this supplier's previous box price. No per-unit anything.
  const current = entered > 0 ? entered : lastPrice
  const move    = priceMove(current, prevPrice)

  return (
    <div className={`flex-1 min-w-0 rounded-lg p-2 border transition-colors ${
      isRecommended ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Supplier name */}
      <p className={`text-xs font-bold mb-1.5 leading-none ${isRecommended ? 'text-green-700' : 'text-gray-600'}`}>
        {label}
      </p>

      {/* Qty stepper */}
      <div className="flex items-center gap-1 mb-1.5">
        <button onClick={() => onUpdate({ qty: Math.max(0, row.qty - 1) })}
          className="w-7 h-7 rounded-md border border-gray-300 bg-white text-gray-900 font-bold flex items-center justify-center active:bg-gray-100 text-base">−</button>
        <span className="w-5 text-center font-bold text-gray-900 text-sm">{row.qty}</span>
        <button onClick={() => onUpdate({ qty: row.qty + 1 })}
          className="w-7 h-7 rounded-md border border-gray-300 bg-white text-gray-900 font-bold flex items-center justify-center active:bg-gray-100 text-base">+</button>
      </div>

      {/* Price row: £ label + narrow input + /box */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-gray-400 text-xs shrink-0">£</span>
        <input
          type="number" inputMode="decimal" step="0.50" min="0"
          value={row.pricePounds}
          onChange={e => onUpdate({ pricePounds: e.target.value })}
          placeholder="0.00"
          className={`w-16 px-1.5 py-1.5 rounded-lg text-xs font-mono border-2 text-gray-900 bg-white outline-none focus:ring-2 focus:ring-gray-900
            [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
            ${row.status === 'red'   ? 'border-red-400'
            : row.status === 'amber' ? 'border-amber-400'
            : row.status === 'green' ? 'border-green-500'
            : 'border-gray-200'}`}
        />
        <span className="text-[9px] text-gray-400">/box</span>
      </div>

      {/* Count per box — only for count/piece items; pre-filled, override if different format */}
      {showCount && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[9px] text-gray-400 shrink-0">×</span>
          <input
            type="number" inputMode="numeric" min="1"
            value={row.countPerBox}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (v > 0) onUpdate({ countPerBox: v })
            }}
            className={`w-12 px-1.5 py-1 rounded-lg text-xs font-mono border text-gray-900 bg-white outline-none focus:ring-2 focus:ring-gray-900
              [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
              ${countChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
          />
          <span className="text-[9px] text-gray-400">in box</span>
        </div>
      )}
      {/* Last purchase price on its own line — clear reference */}
      <p className="text-[9px] text-gray-400 mb-0.5">
        {lastPrice
          ? <>last {fmt(lastPrice)}{lastDate ? <span className="text-gray-300"> · {lastDate}</span> : null}</>
          : <span className="italic">no prior price</span>}
      </p>

      {/* Up or down vs the buy before */}
      {move && (
        <p className={`text-[10px] mt-0.5 font-semibold leading-tight ${
          move.tone === 'down' ? 'text-green-700'
          : move.tone === 'up' ? 'text-red-600'
          : 'text-gray-400'
        }`}>{move.text}</p>
      )}

      {/* Cheaper-than-last badge */}
      {row.status === 'green' && row.qty > 0 && (
        <p className="text-[9px] text-green-600 font-semibold mt-1">🎯 cheaper than last</p>
      )}
    </div>
  )
}
