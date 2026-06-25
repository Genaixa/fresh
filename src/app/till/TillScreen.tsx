'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { recordTransaction } from './actions'
import { formatPrice } from '@/lib/pricing-engine'
import { parseScaleBarcode } from '@/lib/scale-barcode'
import {
  enqueueSale, allPending, removePending, countPending, newClientUuid,
} from '@/lib/till-offline'

type TillProduct = {
  id: string
  name: string
  category: 'fruit' | 'veg' | 'other'
  unit: string
  retail_price: number
  plu_code: number | null
}

// Ordered longest-match-first to avoid partial collisions (e.g. grapefruit before grape)
const EMOJI_MAP: [string, string][] = [
  ['watermelon',   '🍉'],
  ['sweet potato', '🍠'],
  ['grapefruit',   ''],    // no good emoji — would confuse with orange
  ['blueberr',     '🫐'],
  ['strawberr',    '🍓'],
  ['aubergine',    '🍆'],
  ['pineapple',    '🍍'],
  ['broccoli',     '🥦'],
  ['avocado',      '🥑'],
  ['coconut',      '🥥'],
  ['cucumber',     '🥒'],
  ['mushroom',     '🍄'],
  ['banana',       '🍌'],
  ['garlic',       '🧄'],
  ['grape',        '🍇'],
  ['lemon',        '🍋'],
  ['mango',        '🥭'],
  ['melon',        '🍈'],
  ['onion',        '🧅'],
  ['orange',       '🍊'],
  ['peach',        '🍑'],
  ['pepper',       '🫑'],
  ['tomato',       '🍅'],
  ['potato',       '🥔'],
  ['carrot',       '🥕'],
  ['cherry',       '🍒'],
  ['kiwi',         '🥝'],
  ['pear',         '🍐'],
  ['apple',        '🍎'],
]

function getEmoji(name: string): string {
  const lower = name.toLowerCase()
  for (const [keyword, emoji] of EMOJI_MAP) {
    if (lower.includes(keyword)) return emoji
  }
  return ''
}

type BasketItem = {
  key: string
  product_id: string
  name: string
  unit: string
  unit_price: number
  quantity: number
  line_total: number
}

type Category = 'all' | 'fruit' | 'veg' | 'other'
type PayStep = 'cash' | 'card' | null

function calcLine(unitPrice: number, qty: number) {
  return Math.round(unitPrice * qty)
}

function Numpad({ onDigit }: { onDigit: (d: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(d => (
        <button
          key={d}
          onClick={() => onDigit(d)}
          className="py-3.5 rounded-xl bg-white/10 text-lg font-semibold active:bg-white/25 transition-colors select-none"
        >
          {d}
        </button>
      ))}
    </div>
  )
}

export function TillScreen({ products }: { products: TillProduct[] }) {
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [weightModal, setWeightModal] = useState<TillProduct | null>(null)
  const [weightValue, setWeightValue] = useState('')
  const [payStep, setPayStep] = useState<PayStep>(null)
  const [cashInput, setCashInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scanMsg, setScanMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [saleChange, setSaleChange] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(true)
  const [time, setTime] = useState('')
  const weightRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (weightModal) setTimeout(() => weightRef.current?.focus(), 80)
  }, [weightModal])

  // ── Offline-first sync ──────────────────────────────────────────────────
  // Drain the local queue to the server. Safe to call anytime: each sale carries
  // a client_uuid so the server records it exactly once; a sale is removed from
  // the queue only after the server confirms it. Stops on the first failure so a
  // dropped connection just leaves everything queued for the next attempt.
  const flushingRef = useRef(false)
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      const pend = await allPending()
      for (const s of pend) {
        try {
          const res = await recordTransaction({
            client_uuid: s.client_uuid,
            total_pence: s.total_pence,
            payment_method: s.payment_method,
            cash_tendered_pence: s.cash_tendered_pence,
            change_pence: s.change_pence,
            items: s.items,
          })
          if (res.ok) await removePending(s.client_uuid)
          else break   // server reachable but rejected — keep queued, retry later
        } catch {
          break        // offline / network error — keep queued
        }
      }
      setPendingCount(await countPending())
    } finally {
      flushingRef.current = false
    }
  }, [])

  useEffect(() => {
    setOnline(navigator.onLine)
    countPending().then(setPendingCount).catch(() => {})
    void flushQueue()
    const goOnline = () => { setOnline(true); void flushQueue() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const iv = setInterval(() => { void flushQueue() }, 15000)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(iv)
    }
  }, [flushQueue])

  const total = useMemo(() => basket.reduce((s, i) => s + i.line_total, 0), [basket])

  const cashPence = useMemo(() => {
    const v = parseFloat(cashInput)
    return isNaN(v) ? 0 : Math.round(v * 100)
  }, [cashInput])

  const change = cashPence - total

  const cashPresets = useMemo(() => {
    const base = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
    return base.filter(p => p >= total).slice(0, 4)
  }, [total])

  const filtered = useMemo(() => {
    let r = products
    if (category !== 'all') r = r.filter(p => p.category === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(p => p.name.toLowerCase().includes(q))
    }
    return r
  }, [products, category, search])

  // PLU → product, for resolving a scanned weigh-by-label barcode.
  const pluMap = useMemo(() => {
    const m = new Map<number, TillProduct>()
    for (const p of products) if (p.plu_code != null) m.set(p.plu_code, p)
    return m
  }, [products])

  function flashScan(kind: 'ok' | 'err', text: string) {
    setScanMsg({ kind, text })
    setTimeout(() => setScanMsg(null), kind === 'ok' ? 1500 : 2500)
  }

  function handleScan(code: string) {
    const parsed = parseScaleBarcode(code)
    if (!parsed) { flashScan('err', 'Unrecognised barcode'); return }
    const product = pluMap.get(parsed.plu)
    if (!product) { flashScan('err', `No product for PLU ${parsed.plu}`); return }

    const unit_price = product.retail_price
    let quantity: number
    let line_total: number
    if (parsed.pricePence != null) {
      // Price-embedded: honour the price the customer sees on the label; derive
      // the weight for the record from our £/kg so the line still reconciles.
      line_total = parsed.pricePence
      quantity = unit_price > 0 ? parsed.pricePence / unit_price : 0
    } else {
      quantity = parsed.weightKg ?? 0
      line_total = calcLine(unit_price, quantity)
    }
    setBasket(prev => [...prev, {
      key: `${product.id}-scan-${Date.now()}`,
      product_id: product.id,
      name: product.name,
      unit: 'kg',
      unit_price,
      quantity,
      line_total,
    }])
    setSearch('')
    flashScan('ok', `${product.name} · ${formatPrice(line_total)}`)
  }

  // Keep refs fresh so the single keydown listener never holds a stale closure.
  const handleScanRef = useRef(handleScan)
  const scanBlockedRef = useRef(false)
  useEffect(() => { handleScanRef.current = handleScan })
  useEffect(() => { scanBlockedRef.current = !!weightModal || !!payStep || saving })

  // Keyboard-wedge scanner: a barcode reader "types" the digits fast and ends
  // with Enter. We treat a fast digit burst terminated by Enter as a scan.
  useEffect(() => {
    let buf = ''
    let last = 0
    function onKey(e: KeyboardEvent) {
      if (scanBlockedRef.current) return
      const now = Date.now()
      if (now - last > 60) buf = ''   // slow gap = human typing, not one scan
      last = now
      if (e.key === 'Enter') {
        if (buf.length >= 8) { handleScanRef.current(buf); e.preventDefault() }
        buf = ''
        return
      }
      if (/^[0-9]$/.test(e.key)) buf += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function tapProduct(p: TillProduct) {
    if (p.unit === 'kg') {
      setWeightValue('')
      setWeightModal(p)
      return
    }
    setBasket(prev => {
      const idx = prev.findIndex(i => i.product_id === p.id)
      if (idx >= 0) {
        return prev.map((item, i) => i === idx
          ? { ...item, quantity: item.quantity + 1, line_total: calcLine(item.unit_price, item.quantity + 1) }
          : item)
      }
      return [...prev, {
        key: p.id,
        product_id: p.id,
        name: p.name,
        unit: p.unit,
        unit_price: p.retail_price,
        quantity: 1,
        line_total: p.retail_price,
      }]
    })
  }

  function decrement(key: string) {
    setBasket(prev => {
      const item = prev.find(i => i.key === key)
      if (!item) return prev
      if (item.quantity <= 1 || item.unit === 'kg') return prev.filter(i => i.key !== key)
      return prev.map(i => i.key === key
        ? { ...i, quantity: i.quantity - 1, line_total: calcLine(i.unit_price, i.quantity - 1) }
        : i)
    })
  }

  function increment(key: string) {
    setBasket(prev => prev.map(i => i.key === key
      ? { ...i, quantity: i.quantity + 1, line_total: calcLine(i.unit_price, i.quantity + 1) }
      : i))
  }

  function appendWeightDigit(d: string) {
    setWeightValue(prev => {
      if (d === '⌫') return prev.slice(0, -1)
      if (d === '.' && prev.includes('.')) return prev
      return prev + d
    })
  }

  function confirmWeight() {
    if (!weightModal) return
    const kg = parseFloat(weightValue)
    if (isNaN(kg) || kg <= 0) return
    const line_total = calcLine(weightModal.retail_price, kg)
    setBasket(prev => [...prev, {
      key: `${weightModal.id}-${Date.now()}`,
      product_id: weightModal.id,
      name: weightModal.name,
      unit: 'kg',
      unit_price: weightModal.retail_price,
      quantity: kg,
      line_total,
    }])
    setWeightModal(null)
    setWeightValue('')
  }

  function appendCashDigit(d: string) {
    setCashInput(prev => {
      if (d === '⌫') return prev.slice(0, -1)
      if (d === '.' && prev.includes('.')) return prev
      const next = prev + d
      // Prevent more than 2 decimal places
      const parts = next.split('.')
      if (parts[1]?.length > 2) return prev
      return next
    })
  }

  async function completeSale(method: 'cash' | 'card') {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    const savedChange = method === 'cash' ? change : null
    try {
      // Durable local write FIRST — the sale is safe before any network. The
      // background flusher syncs it to the server (exactly once, via client_uuid).
      await enqueueSale({
        client_uuid: newClientUuid(),
        queued_at: Date.now(),
        total_pence: total,
        payment_method: method,
        cash_tendered_pence: method === 'cash' ? cashPence : null,
        change_pence: method === 'cash' ? change : null,
        items: basket.map(i => ({
          product_id: i.product_id,
          product_name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          unit_price_pence: i.unit_price,
          line_total_pence: i.line_total,
        })),
      })
    } catch {
      // Local store itself failed — the one case we must not let pass silently.
      setSaving(false)
      setSaveError('Could not save the sale on this device — try again')
      return
    }
    setSaving(false)
    setBasket([])
    setPayStep(null)
    setCashInput('')
    setPendingCount(await countPending())
    void flushQueue()
    if (savedChange !== null) {
      setSaleChange(savedChange)
      setTimeout(() => setSaleChange(null), 4000)
    }
  }

  return (
    <div className="dark fixed inset-0 bg-[var(--bg-primary)] flex flex-col overflow-hidden select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <span className="font-bold text-brand-accent">Fresh &amp; Fruity</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">{time}</span>
          {!online ? (
            <span data-testid="sync-status" data-state="offline" data-pending={pendingCount}
              className="text-[11px] px-2 py-1 rounded-full bg-status-amber/20 text-status-amber font-medium">
              ⚠ Offline{pendingCount > 0 ? ` · ${pendingCount}` : ''}
            </span>
          ) : pendingCount > 0 ? (
            <span data-testid="sync-status" data-state="pending" data-pending={pendingCount}
              className="text-[11px] px-2 py-1 rounded-full bg-brand-accent/20 text-brand-accent font-medium">
              ⟳ {pendingCount} to sync
            </span>
          ) : (
            <span data-testid="sync-status" data-state="synced" data-pending={0}
              className="text-[11px] px-2 py-1 rounded-full bg-status-green/15 text-status-green font-medium">
              ✓ Synced
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/till/sales" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">
            Today
          </Link>
          <Link href="/till/eod" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">
            Day
          </Link>
          <Link href="/dashboard" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">
            Exit
          </Link>
        </div>
      </div>

      {/* Save-failure banner — a sale that didn't save must never look like one that did */}
      {saveError && (
        <button
          onClick={() => setSaveError(null)}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-[60] max-w-[90%] bg-status-red text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg active:opacity-80"
        >
          ⚠ {saveError} — tap to dismiss
        </button>
      )}

      {/* Scan feedback — confirms a scanned label landed, or why it didn't */}
      {scanMsg && (
        <div
          className={`absolute top-14 left-1/2 -translate-x-1/2 z-[55] max-w-[90%] text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg
            ${scanMsg.kind === 'ok' ? 'bg-status-green text-white' : 'bg-status-amber text-black'}`}
        >
          {scanMsg.kind === 'ok' ? '✓' : '⚠'} {scanMsg.text}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 pt-2 pb-1 space-y-2 shrink-0">
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field w-full py-2 text-sm"
            />
            <div className="flex gap-1.5">
              {(['all', 'fruit', 'veg', 'other'] as Category[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors
                    ${category === c
                      ? 'bg-brand-accent/20 text-brand-accent ring-1 ring-brand-accent/40'
                      : 'card text-[var(--text-muted)]'}`}
                >
                  {c === 'all' ? 'All' : c === 'fruit' ? 'Fruit' : c === 'veg' ? 'Veg' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="grid grid-cols-3 gap-1.5">
              {filtered.map(p => {
                const emoji = getEmoji(p.name)
                return (
                  <button
                    key={p.id}
                    data-testid="till-product"
                    onPointerDown={() => tapProduct(p)}
                    className="card p-2.5 text-left active:scale-95 active:bg-white/10 transition-transform min-h-[68px] flex flex-col justify-between"
                  >
                    <div>
                      {emoji && <span className="text-2xl leading-none">{emoji}</span>}
                      <p className="text-xs font-medium leading-snug mt-0.5">{p.name}</p>
                    </div>
                    <span className="text-xs text-brand-accent font-semibold">
                      {formatPrice(p.retail_price)}{p.unit === 'kg' ? '/kg' : ''}
                    </span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="col-span-3 text-center text-sm text-[var(--text-muted)] py-8">No products</p>
              )}
            </div>
          </div>
        </div>

        {/* Basket */}
        <div className="w-60 flex flex-col border-l border-white/10 bg-[var(--bg-secondary)]">
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {basket.length === 0 && (
              <p className="text-center text-xs text-[var(--text-muted)] mt-10">Tap a product to add</p>
            )}
            {basket.map(item => (
              <div key={item.key} className="card p-2 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-medium leading-snug flex-1">{item.name}</span>
                  <button onPointerDown={() => decrement(item.key)} className="text-status-red/70 text-xs leading-none p-0.5">✕</button>
                </div>
                {item.unit === 'kg' ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{item.quantity.toFixed(3)} kg</span>
                    <span className="font-semibold">{formatPrice(item.line_total)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onPointerDown={() => decrement(item.key)} className="w-6 h-6 rounded-md bg-white/10 text-xs flex items-center justify-center active:bg-white/20">−</button>
                      <span className="text-xs w-4 text-center font-semibold">{item.quantity}</span>
                      <button onPointerDown={() => increment(item.key)} className="w-6 h-6 rounded-md bg-white/10 text-xs flex items-center justify-center active:bg-white/20">+</button>
                    </div>
                    <span className="text-xs font-semibold">{formatPrice(item.line_total)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total & pay */}
          <div className="shrink-0 p-3 border-t border-white/10 space-y-3">
            {saleChange !== null && (
              <div className="bg-status-green/20 border border-status-green/30 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-[var(--text-muted)]">Change</p>
                <p className="text-xl font-bold text-status-green">{formatPrice(saleChange)}</p>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[var(--text-muted)]">Total</span>
              <span className="text-2xl font-bold">{formatPrice(total)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onPointerDown={() => { setCashInput(''); setPayStep('cash') }}
                disabled={basket.length === 0}
                className="flex-1 py-3.5 rounded-xl bg-status-green/20 text-status-green font-bold text-sm active:bg-status-green/30 disabled:opacity-30 transition-colors"
              >
                Cash
              </button>
              <button
                data-testid="pay-card"
                onPointerDown={() => setPayStep('card')}
                disabled={basket.length === 0}
                className="flex-1 py-3.5 rounded-xl bg-brand-accent/20 text-brand-accent font-bold text-sm active:bg-brand-accent/30 disabled:opacity-30 transition-colors"
              >
                Card
              </button>
            </div>
            {basket.length > 0 && (
              <button
                onPointerDown={() => setBasket([])}
                className="w-full text-xs text-status-red/50 py-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Weight modal */}
      {weightModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-[280px] p-4 space-y-3">
            <div>
              <p className="font-bold text-base">{weightModal.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatPrice(weightModal.retail_price)} per kg</p>
            </div>

            <div className="bg-black/40 rounded-xl px-4 py-3 text-right">
              <span className="text-3xl font-bold font-mono tabular-nums">{weightValue || '0'}</span>
              <span className="text-base text-[var(--text-muted)] ml-1.5">kg</span>
            </div>

            {/* Hidden input captures scale keystrokes when focused */}
            <input
              ref={weightRef}
              className="sr-only"
              type="text"
              inputMode="decimal"
              value={weightValue}
              onChange={e => setWeightValue(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') confirmWeight() }}
            />

            {weightValue && !isNaN(parseFloat(weightValue)) && parseFloat(weightValue) > 0 && (
              <p className="text-right text-sm font-semibold text-brand-accent">
                = {formatPrice(calcLine(weightModal.retail_price, parseFloat(weightValue)))}
              </p>
            )}

            <Numpad onDigit={appendWeightDigit} />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setWeightModal(null); setWeightValue('') }}
                className="flex-1 py-3 rounded-xl border border-white/20 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmWeight}
                disabled={!weightValue || isNaN(parseFloat(weightValue)) || parseFloat(weightValue) <= 0}
                className="flex-1 py-3 rounded-xl bg-status-green/20 text-status-green font-bold text-sm disabled:opacity-30"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash payment modal */}
      {payStep === 'cash' && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-[280px] p-4 space-y-3">
            <p className="font-bold text-base">Cash Payment</p>
            <p className="text-3xl font-bold text-center">{formatPrice(total)}</p>

            {cashPresets.length > 0 && (
              <div className="flex gap-1.5">
                {cashPresets.map(p => (
                  <button
                    key={p}
                    onClick={() => setCashInput((p / 100).toFixed(2))}
                    className="flex-1 py-2 rounded-xl bg-white/10 text-xs font-semibold active:bg-white/20"
                  >
                    {formatPrice(p)}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-black/40 rounded-xl px-4 py-3 text-right">
              <span className="text-xs text-[var(--text-muted)] mr-2">Tendered</span>
              <span className="text-2xl font-bold font-mono tabular-nums">
                £{cashInput || '0.00'}
              </span>
            </div>

            {cashPence >= total && (
              <div className="text-right">
                <span className="text-xs text-[var(--text-muted)] mr-2">Change</span>
                <span className="text-2xl font-bold text-status-green">{formatPrice(change)}</span>
              </div>
            )}

            <Numpad onDigit={appendCashDigit} />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPayStep(null)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => completeSale('cash')}
                disabled={cashPence < total || saving}
                className="flex-1 py-3 rounded-xl bg-status-green/20 text-status-green font-bold text-sm disabled:opacity-30"
              >
                {saving ? '...' : '✓ Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card payment modal */}
      {payStep === 'card' && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-[280px] p-6 text-center space-y-4">
            <p className="font-bold text-base">Card Payment</p>
            <p className="text-4xl font-bold">{formatPrice(total)}</p>
            <p className="text-5xl">💳</p>
            <p className="text-sm text-[var(--text-muted)]">Tap or insert on SumUp reader</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPayStep(null)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-sm"
              >
                Cancel
              </button>
              <button
                data-testid="card-confirm"
                onClick={() => completeSale('card')}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-brand-accent/20 text-brand-accent font-bold text-sm disabled:opacity-30"
              >
                {saving ? '...' : '✓ Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
