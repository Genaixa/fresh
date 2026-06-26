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

// Pure: products → notable price moves. No clock, no division.
export function computeSignals(products: MarketProduct[]): Signal[] {
  const out: Signal[] = []

  for (const p of products) {
    if (!CONFIG[p.name]) continue

    const candidates: { supplier: 'Dole' | 'Holland'; last: number; prev: number }[] = []
    if (p.doleLastPricePence && p.dolePrevPricePence)
      candidates.push({ supplier: 'Dole', last: p.doleLastPricePence, prev: p.dolePrevPricePence })
    if (p.hollandLastPricePence && p.hollandPrevPricePence)
      candidates.push({ supplier: 'Holland', last: p.hollandLastPricePence, prev: p.hollandPrevPricePence })
    if (candidates.length === 0) continue

    // Represent the product by the supplier with the cheaper current box price.
    const pick = candidates.reduce((a, b) => (b.last < a.last ? b : a))
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
