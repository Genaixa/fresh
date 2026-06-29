import type { MarketProduct } from './page'
import { CONFIG } from './config'

// ── Deterministic buying signals — box price vs the buy before ──────────────
// The model: for each product, did the box price David pays go UP or DOWN since
// his previous purchase? Pure invoice box price (unit_cost), no per-unit division,
// so the parser's weight/count guesses CANNOT create rubbish. This works because
// it's the SAME supplier's SAME box over time — no pack-size mismatch.
//
// NOTE: we deliberately do NOT auto-say "Dole vs Holland cheaper". The two
// suppliers sell different box sizes (Dole pea £10/3kg box vs Holland £1.15/bag),
// so a box-price comparison is meaningless and a per-unit one needs the parser's
// pack guesses — i.e. the rubbish. The rows show both suppliers' prices side by
// side; David compares them himself, knowing the pack sizes.

export type SignalKind = 'down' | 'up'

export type Signal = {
  product:   string
  kind:      SignalKind
  supplier:  'Dole' | 'Holland'
  lastP:     number
  prevP:     number
  pct:       number          // signed fraction, e.g. -0.45
  text:      string          // deterministic plain-English statement (always correct)
  magnitude: number          // |pct|, for ranking
}

const f = (p: number) => `£${(p / 100).toFixed(2)}`
const THRESHOLD = 0.10

// ── Recency guard ───────────────────────────────────────────────────────────
// David buys DAILY, and wants day-to-day fluctuation on the things he buys
// REGULARLY — not "cheaper than some buy 6 months ago". So a move only shows if
// he's bought the item at least twice in the last ~2 weeks: BOTH the latest buy
// AND the one it's compared against must be recent. Anything bought only once
// recently, or compared to an old buy, stays quiet.
const MAX_LAST_AGE_DAYS = 14   // latest buy — there's a current price to act on
const MAX_PREV_AGE_DAYS = 14   // the buy it's compared to — keeps it a regular-purchase fluctuation, not an ancient one

function ageDays(fromISO: string | null | undefined, asOfISO: string): number | null {
  if (!fromISO) return null
  const from = Date.parse(fromISO), asOf = Date.parse(asOfISO)
  if (Number.isNaN(from) || Number.isNaN(asOf)) return null
  return Math.floor((asOf - from) / 86_400_000)
}

// products → notable, RECENT price moves. asOfISO = the run date (the clock the
// recency guard is measured against).
export function computeSignals(products: MarketProduct[], asOfISO: string): Signal[] {
  const out: Signal[] = []

  for (const p of products) {
    if (!CONFIG[p.name]) continue

    const candidates: { supplier: 'Dole' | 'Holland'; last: number; prev: number; lastDate: string | null; prevDate: string | null }[] = []
    if (p.doleLastPricePence && p.dolePrevPricePence)
      candidates.push({ supplier: 'Dole', last: p.doleLastPricePence, prev: p.dolePrevPricePence, lastDate: p.doleLastDateISO, prevDate: p.dolePrevDate })
    if (p.hollandLastPricePence && p.hollandPrevPricePence)
      candidates.push({ supplier: 'Holland', last: p.hollandLastPricePence, prev: p.hollandPrevPricePence, lastDate: p.hollandLastDateISO, prevDate: p.hollandPrevDate })
    if (candidates.length === 0) continue

    // Recency guard — drop any candidate without a current price + a non-ancient
    // "last time". No recent prices to refer to → stay quiet on this product.
    const fresh = candidates.filter(c => {
      const la = ageDays(c.lastDate, asOfISO)
      const pa = ageDays(c.prevDate, asOfISO)
      return la !== null && pa !== null && la <= MAX_LAST_AGE_DAYS && pa <= MAX_PREV_AGE_DAYS
    })
    if (fresh.length === 0) continue

    // Represent the product by the supplier with the cheaper current box price.
    const pick = fresh.reduce((a, b) => (b.last < a.last ? b : a))
    const pct  = (pick.last - pick.prev) / pick.prev
    if (Math.abs(pct) < THRESHOLD) continue

    const kind = pct < 0 ? 'down' : 'up'
    const sign = pct > 0 ? '+' : ''
    const tail = kind === 'down' ? ' — cheaper, stock up' : ' — dearer, watch'
    out.push({
      product: p.name, kind, supplier: pick.supplier, lastP: pick.last, prevP: pick.prev,
      pct, magnitude: Math.abs(pct),
      text: `${p.name} (${pick.supplier}): ${f(pick.prev)} → ${f(pick.last)}, ${sign}${Math.round(pct * 100)}%${tail}.`,
    })
  }

  return out.sort((a, b) => b.magnitude - a.magnitude)
}

// Deterministic prose straight from the signals — always-correct fallback and the
// source of truth the LLM's wording is validated against.
export function briefingFromSignals(signals: Signal[]): { briefing: string | null; tips: Record<string, string> } {
  const tips: Record<string, string> = {}
  for (const s of signals) if (!tips[s.product]) tips[s.product] = s.text

  if (signals.length === 0)
    return { briefing: "No big price moves since last time — everything's about the same.", tips }

  const downs = signals.filter(s => s.kind === 'down').slice(0, 4).map(s => s.product)
  const ups   = signals.filter(s => s.kind === 'up').slice(0, 4).map(s => s.product)

  const parts: string[] = []
  if (downs.length) parts.push(`Cheaper than last time: ${downs.join(', ')}.`)
  if (ups.length)   parts.push(`Dearer than last time: ${ups.join(', ')}.`)

  return { briefing: parts.join(' '), tips }
}

// Product names that have a signal — the allow-list the LLM prose is checked against.
export function signalProducts(signals: Signal[]): Set<string> {
  return new Set(signals.map(s => s.product))
}

// ── Cross-supplier "best price" — SOUND per-unit comparison ──────────────────
// The thing deliberately switched off before, done right. It compares Dole vs
// Holland PER UNIT (£/each or £/kg) using the latest box price ÷ that box's
// CONFIRMED pack spec — never the parser's guesses. Gated four ways, else quiet:
//   • both suppliers bought within MAX_LAST_AGE_DAYS (both prices current)
//   • same unit basis (both count, or both weight) — no apples-to-oranges
//   • a usable spec on both boxes (count>0 / kg>0)
//   • the gap is real but not absurd: ≥ MIN_GAP and ≤ MAX_PLAUSIBLE_RATIO
//     (a >3× gap is almost always a bad spec, e.g. Tomato 467p/kg vs 116p/kg)
const BEST_MIN_GAP = 0.05          // <5% apart → "about the same", no recommendation
const MAX_PLAUSIBLE_RATIO = 3      // >3× apart → suspect spec, stay quiet

export type SupplierBox = {
  p: number                        // latest box price, pence
  date: string | null
  unitType: string | null          // 'count' | 'weight'
  perEach: number | null           // units_per_case (for count)
  perKg: number | null             // box_weight_kg (for weight)
}
export type BestBuy = { winner: 'Dole' | 'Holland'; text: string }

const fp = (pence: number) => (pence < 100 ? `${Math.round(pence)}p` : `£${(pence / 100).toFixed(2)}`)

export function computeBestSupplier(dole: SupplierBox | null, holland: SupplierBox | null, asOfISO: string): BestBuy | null {
  if (!dole || !holland || !dole.p || !holland.p) return null
  // both prices must be current
  const da = ageDays(dole.date, asOfISO), ha = ageDays(holland.date, asOfISO)
  if (da === null || ha === null || da > MAX_LAST_AGE_DAYS || ha > MAX_LAST_AGE_DAYS) return null
  // same unit basis only
  if (!dole.unitType || dole.unitType !== holland.unitType) return null
  const weight = dole.unitType === 'weight'
  const dDiv = weight ? dole.perKg : dole.perEach
  const hDiv = weight ? holland.perKg : holland.perEach
  if (!dDiv || !hDiv || dDiv <= 0 || hDiv <= 0) return null

  const dolePer = dole.p / dDiv, hollPer = holland.p / hDiv
  const lo = Math.min(dolePer, hollPer), hi = Math.max(dolePer, hollPer)
  if (hi / lo > MAX_PLAUSIBLE_RATIO) return null   // suspect spec — don't mislead
  if ((hi - lo) / hi < BEST_MIN_GAP) return null    // basically equal
  const winner: 'Dole' | 'Holland' = dolePer <= hollPer ? 'Dole' : 'Holland'
  const unit = weight ? '/kg' : ' ea'
  return { winner, text: `Best price: ${winner} — ${fp(lo)}${unit} vs ${fp(hi)}${unit}` }
}
