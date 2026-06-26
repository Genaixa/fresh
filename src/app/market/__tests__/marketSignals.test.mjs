/**
 * Unit tests for computeSignals() — the deterministic market-run advice core.
 * Run: node --test src/app/market/__tests__/marketSignals.test.mjs
 *
 * Convention (same as getGolemAdvice.test.mjs): the logic is mirrored inline so
 * the test runs under plain `node --test` with no TS loader. If the real
 * freshAndPlausible / cross-supplier / signal thresholds in marketSignals.ts
 * change, update this copy.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const STALE_DAYS = 14
const f = p => `£${(p / 100).toFixed(2)}`

function freshAndPlausible(price, date, avg, now) {
  if (!price) return false
  const stale = date ? (now - new Date(date + 'T00:00:00').getTime()) / 86_400_000 > STALE_DAYS : false
  if (stale) return false
  if (avg && (price > avg * 3 || price < avg * 0.33)) return false
  return true
}

// Faithful mirror of computeSignals() for one product (unit passed in directly
// rather than via CONFIG). Returns the signal list for [p].
function signalsFor(p, now) {
  const out = []
  const u = p.unit
  const avg = p.recentUnitAvgPence
  const dOk = freshAndPlausible(p.doleUnitPricePence, p.doleUnitDate, avg, now)
  const hOk = freshAndPlausible(p.hollandUnitPricePence, p.hollandUnitDate, avg, now)
  let dUse = dOk, hUse = hOk
  if (dOk && hOk) {
    const d = p.doleUnitPricePence, h = p.hollandUnitPricePence
    if (Math.max(d, h) > Math.min(d, h) * 2.5) { if (d > h) dUse = false; else hUse = false }
  }
  const usable = []
  if (dUse) usable.push({ sup: 'Dole', price: p.doleUnitPricePence })
  if (hUse) usable.push({ sup: 'Holland', price: p.hollandUnitPricePence })
  if (!usable.length) return out
  const best = usable.reduce((a, b) => (b.price < a.price ? b : a))
  if (p.maxUnitPence && best.price > p.maxUnitPence * 1.05) {
    const over = best.price - p.maxUnitPence
    out.push({ product: p.name, kind: 'over_max', text: `${p.name}: cheapest is ${best.sup} at ${f(best.price)}/${u}, ${f(over)} over the ${f(p.maxUnitPence)} max — negotiate or skip.` })
  }
  if (avg) {
    const pct = (best.price - avg) / avg
    if (pct <= -0.10) out.push({ product: p.name, kind: 'bargain', text: `${p.name}: ${best.sup} ${f(best.price)}/${u}, ${Math.round(-pct * 100)}% below the ${f(avg)} avg — buy more than usual.` })
    else if (pct >= 0.10) out.push({ product: p.name, kind: 'dear', text: `${p.name}: cheapest is ${best.sup} ${f(best.price)}/${u}, ${Math.round(pct * 100)}% above the ${f(avg)} avg.` })
  }
  if (dUse && hUse) {
    const d = p.doleUnitPricePence, h = p.hollandUnitPricePence
    const cheap = d < h ? 'Dole' : 'Holland'
    const lo = Math.min(d, h), hi = Math.max(d, h)
    if (lo < hi * 0.90) out.push({ product: p.name, kind: 'cheaper_supplier', text: `${p.name}: ${cheap} cheaper at ${f(lo)}/${u} vs ${f(hi)}.` })
  }
  return out
}

const NOW = new Date('2026-06-26T08:00:00Z').getTime()
const fresh = '2026-06-25'
const stale = '2026-02-24'
const mk = o => ({ recentUnitAvgPence: null, maxUnitPence: 0, doleUnitPricePence: null, doleUnitDate: null, hollandUnitPricePence: null, hollandUnitDate: null, ...o })

test('stale + implausible Dole price yields no false signal citing Dole (cucumber)', () => {
  const sigs = signalsFor(mk({ name: 'Cucumber', unit: 'each', recentUnitAvgPence: 54, maxUnitPence: 120,
    doleUnitPricePence: 1100, doleUnitDate: stale, hollandUnitPricePence: 78, hollandUnitDate: fresh }), NOW)
  assert.ok(!sigs.some(s => s.text.includes('Dole')), 'no signal should cite the stale/implausible Dole price')
})

test('cross-supplier 5x gap is suppressed, not a cheaper-supplier bargain (mushroom)', () => {
  const sigs = signalsFor(mk({ name: 'Mushroom Punnet', unit: 'punnet', recentUnitAvgPence: 133, maxUnitPence: 150,
    doleUnitPricePence: 367, doleUnitDate: fresh, hollandUnitPricePence: 72, hollandUnitDate: fresh }), NOW)
  assert.ok(!sigs.some(s => s.kind === 'cheaper_supplier'), 'a 5x cross-supplier gap is a spec error, not a signal')
})

test('genuine above-avg fresh price produces a dear signal (grapes)', () => {
  const sigs = signalsFor(mk({ name: 'Grapes', unit: 'kg', recentUnitAvgPence: 172, maxUnitPence: 400,
    doleUnitPricePence: 200, doleUnitDate: fresh, hollandUnitPricePence: 160, hollandUnitDate: '2025-03-03' }), NOW)
  assert.ok(sigs.some(s => s.kind === 'dear' && s.product === 'Grapes'), 'Grapes +16% vs avg should be flagged dear')
  assert.ok(!sigs.some(s => s.text.includes('£1.60')), 'must not use the stale Holland £1.60')
})

test('genuine below-avg fresh price produces a bargain (onion)', () => {
  const sigs = signalsFor(mk({ name: 'Onion Spanish', unit: 'kg', recentUnitAvgPence: 60, maxUnitPence: 100,
    hollandUnitPricePence: 34, hollandUnitDate: fresh }), NOW)
  assert.ok(sigs.some(s => s.kind === 'bargain'), 'Onion 43% below avg should be a bargain')
})
