'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { recordTransaction } from './actions'
import { formatPrice } from '@/lib/pricing-engine'

type TillProduct = {
  id: string
  name: string
  category: 'fruit' | 'veg' | 'other'
  unit: string
  retail_price: number
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
  const [saleChange, setSaleChange] = useState<number | null>(null)
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
    await recordTransaction({
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
    const savedChange = method === 'cash' ? change : null
    setBasket([])
    setPayStep(null)
    setCashInput('')
    setSaving(false)
    if (savedChange !== null) {
      setSaleChange(savedChange)
      setTimeout(() => setSaleChange(null), 4000)
    }
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)] flex flex-col overflow-hidden select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <span className="font-bold text-brand-accent">Fresh &amp; Fruity</span>
        <span className="text-sm text-[var(--text-muted)]">{time}</span>
        <Link href="/dashboard" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">
          Exit
        </Link>
      </div>

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
