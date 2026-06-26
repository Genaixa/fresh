import type { MarketProduct } from './page'
import { CONFIG } from './config'

// ── Deterministic buying signals ────────────────────────────────────────────
// The FACTS behind the market-run advice, computed in plain code — never by an
// LLM. A signal cannot claim something the numbers don't support (that's the
// whole point: the LLM was calling a stale £11 cucumber "Dole dearer"). The
// golem may PHRASE these nicely, but the set of claims is fixed here and the
// prose is validated against it. The thresholds mirror the row advice
// (unitAdvice / unitDeal) so the briefing and the row dots never disagree.

export type SignalKind = 'bargain' | 'dear' | 'over_max' | 'cheaper_supplier'

export type Signal = {
  product:  string
  unit:     string          // unitLabel (kg / each / punnet)
  kind:     SignalKind
  text:     string          // deterministic plain-English statement (always correct)
  priority: number          // higher = more important in the briefing
  magnitude: number         // tie-breaker within a priority (e.g. % off, £ over)
}

const STALE_DAYS = 14
const f = (p: number) => `£${(p / 100).toFixed(2)}`

// A supplier price is usable only if fresh AND plausible vs the live average.
function freshAndPlausible(price: number | null, date: string | null, avg: number | null, now: number): price is number {
  if (!price) return false
  const stale = date ? (now - new Date(date + 'T00:00:00').getTime()) / 86_400_000 > STALE_DAYS : false
  if (stale) return false
  if (avg && (price > avg * 3 || price < avg * 0.33)) return false   // bad pack spec
  return true
}

// Pure: products + clock → the list of provable signals. `now` is injectable so
// the staleness cutoff is testable without mocking the global clock.
export function computeSignals(products: MarketProduct[], now: number = Date.now()): Signal[] {
  const out: Signal[] = []

  for (const p of products) {
    const cfg = CONFIG[p.name]
    if (!cfg) continue
    const u   = cfg.unitLabel
    const avg = p.recentUnitAvgPence

    const dOk = freshAndPlausible(p.doleUnitPricePence, p.doleUnitDate, avg, now)
    const hOk = freshAndPlausible(p.hollandUnitPricePence, p.hollandUnitDate, avg, now)

    // Cross-supplier mismatch: two plausible prices that differ >2.5x are a
    // pack-spec error, not a real gap — drop the dearer side from comparison.
    let dUse = dOk, hUse = hOk
    if (dOk && hOk) {
      const d = p.doleUnitPricePence!, h = p.hollandUnitPricePence!
      if (Math.max(d, h) > Math.min(d, h) * 2.5) { if (d > h) dUse = false; else hUse = false }
    }

    const usable: { sup: 'Dole' | 'Holland'; price: number }[] = []
    if (dUse) usable.push({ sup: 'Dole', price: p.doleUnitPricePence! })
    if (hUse) usable.push({ sup: 'Holland', price: p.hollandUnitPricePence! })
    if (usable.length === 0) continue   // nothing trustworthy → no claim to make

    // The buy price = the cheaper usable supplier (what David would actually pay).
    const best = usable.reduce((a, b) => (b.price < a.price ? b : a))

    // 1. Over max — the hard ceiling David set per unit.
    if (p.maxUnitPence && best.price > p.maxUnitPence * 1.05) {
      const over = best.price - p.maxUnitPence
      out.push({ product: p.name, unit: u, kind: 'over_max', priority: 3, magnitude: over,
        text: `${p.name}: cheapest is ${best.sup} at ${f(best.price)}/${u}, ${f(over)} over the ${f(p.maxUnitPence)} max — negotiate or skip.` })
    }

    // 2. vs recent average (only when we have an average to compare to).
    if (avg) {
      const pct = (best.price - avg) / avg
      if (pct <= -0.10) {
        out.push({ product: p.name, unit: u, kind: 'bargain', priority: 2, magnitude: -pct,
          text: `${p.name}: ${best.sup} ${f(best.price)}/${u}, ${Math.round(-pct * 100)}% below the ${f(avg)} avg — buy more than usual.` })
      } else if (pct >= 0.10) {
        out.push({ product: p.name, unit: u, kind: 'dear', priority: 2, magnitude: pct,
          text: `${p.name}: cheapest is ${best.sup} ${f(best.price)}/${u}, ${Math.round(pct * 100)}% above the ${f(avg)} avg.` })
      }
    }

    // 3. One supplier genuinely cheaper (both usable, >10% gap).
    if (dUse && hUse) {
      const d = p.doleUnitPricePence!, h = p.hollandUnitPricePence!
      const cheap = d < h ? 'Dole' : 'Holland'
      const lo = Math.min(d, h), hi = Math.max(d, h)
      if (lo < hi * 0.90) {
        out.push({ product: p.name, unit: u, kind: 'cheaper_supplier', priority: 1, magnitude: (hi - lo) / hi,
          text: `${p.name}: ${cheap} cheaper at ${f(lo)}/${u} vs ${f(hi)}.` })
      }
    }
  }

  // Most important first: priority, then magnitude.
  return out.sort((a, b) => b.priority - a.priority || b.magnitude - a.magnitude)
}

// Deterministic prose straight from the signals — the always-correct fallback
// when no LLM is available or its output fails validation. Also the source of
// truth the LLM's wording is checked against.
export function briefingFromSignals(signals: Signal[]): { briefing: string | null; tips: Record<string, string> } {
  // One tip per product = its highest-priority signal (already sorted).
  const tips: Record<string, string> = {}
  for (const s of signals) if (!tips[s.product]) tips[s.product] = s.text

  if (signals.length === 0) {
    return { briefing: 'Nothing unusual today — supplier prices are in line with recent averages.', tips }
  }

  const bargains = signals.filter(s => s.kind === 'bargain').slice(0, 3).map(s => s.product)
  const watch    = signals.filter(s => s.kind === 'over_max' || s.kind === 'dear').slice(0, 3).map(s => s.product)

  const parts: string[] = []
  if (bargains.length) parts.push(`Best buys today: ${bargains.join(', ')}.`)
  if (watch.length)    parts.push(`Watch (above max/avg): ${watch.join(', ')}.`)
  if (!parts.length)   parts.push(`A few supplier price gaps worth a look — see the tips below.`)

  return { briefing: parts.join(' '), tips }
}

// Set of product names that have at least one signal — the allow-list the
// LLM briefing/tips are validated against.
export function signalProducts(signals: Signal[]): Set<string> {
  return new Set(signals.map(s => s.product))
}
