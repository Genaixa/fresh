/**
 * Unit tests for computeSignals() — box-price-vs-last-buy model + recency guard.
 * Run: node --test src/app/market/__tests__/marketSignals.test.mjs
 * Convention: logic mirrored inline (no TS loader). Update if marketSignals.ts changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const THRESHOLD = 0.10
const MAX_LAST_AGE_DAYS = 14
const MAX_PREV_AGE_DAYS = 14
const ASOF = '2026-06-29'

function ageDays(fromISO, asOfISO) {
  if (!fromISO) return null
  const from = Date.parse(fromISO), asOf = Date.parse(asOfISO)
  if (Number.isNaN(from) || Number.isNaN(asOf)) return null
  return Math.floor((asOf - from) / 86_400_000)
}

function signalsFor(products, asOfISO = ASOF) {
  const out = []
  for (const p of products) {
    const cands = []
    if (p.doleLastPricePence && p.dolePrevPricePence)
      cands.push({ s: 'Dole', last: p.doleLastPricePence, prev: p.dolePrevPricePence, lastDate: p.doleLastDateISO, prevDate: p.dolePrevDate })
    if (p.hollandLastPricePence && p.hollandPrevPricePence)
      cands.push({ s: 'Holland', last: p.hollandLastPricePence, prev: p.hollandPrevPricePence, lastDate: p.hollandLastDateISO, prevDate: p.hollandPrevDate })
    const fresh = cands.filter(c => {
      const la = ageDays(c.lastDate, asOfISO), pa = ageDays(c.prevDate, asOfISO)
      return la !== null && pa !== null && la <= MAX_LAST_AGE_DAYS && pa <= MAX_PREV_AGE_DAYS
    })
    if (!fresh.length) continue
    const pick = fresh.reduce((a, b) => (b.last < a.last ? b : a))
    const pct = (pick.last - pick.prev) / pick.prev
    if (Math.abs(pct) < THRESHOLD) continue
    out.push({ product: p.name, kind: pct < 0 ? 'down' : 'up', pct, supplier: pick.s })
  }
  return out
}

// Defaults: recent dates so date-agnostic tests still exercise the price logic.
const mk = o => ({
  doleLastPricePence: null, dolePrevPricePence: null, doleLastDateISO: '2026-06-26', dolePrevDate: '2026-06-18',
  hollandLastPricePence: null, hollandPrevPricePence: null, hollandLastDateISO: '2026-06-26', hollandPrevDate: '2026-06-18',
  ...o,
})

test('price jump since last buy → up signal (strawberry)', () => {
  const s = signalsFor([mk({ name: 'Strawberry', doleLastPricePence: 4000, dolePrevPricePence: 1600 })])
  assert.equal(s[0].kind, 'up')
})

test('price drop since last buy → down signal (royal gala)', () => {
  const s = signalsFor([mk({ name: 'Apple Royal Gala', doleLastPricePence: 1200, dolePrevPricePence: 2200 })])
  assert.equal(s[0].kind, 'down')
})

test('no previous price → no signal (cannot compare)', () => {
  const s = signalsFor([mk({ name: 'Leek', doleLastPricePence: 700, dolePrevPricePence: null })])
  assert.equal(s.length, 0)
})

test('move under 10% is not notable', () => {
  const s = signalsFor([mk({ name: 'Tomato', doleLastPricePence: 580, dolePrevPricePence: 560 })])
  assert.equal(s.length, 0)
})

test('represents product by the cheaper current supplier', () => {
  const s = signalsFor([mk({ name: 'Onion Spanish',
    doleLastPricePence: 1200, dolePrevPricePence: 1200,
    hollandLastPricePence: 820, hollandPrevPricePence: 1200 })])
  assert.equal(s[0].supplier, 'Holland')
  assert.equal(s[0].kind, 'down')
})

// ── Recency guard ────────────────────────────────────────────────────────────
test('ANCIENT previous price → stay quiet (garlic -41% vs a 15-month-old buy)', () => {
  const s = signalsFor([mk({ name: 'Garlic Loose',
    hollandLastPricePence: 1600, hollandPrevPricePence: 2700,
    hollandLastDateISO: '2026-06-17', hollandPrevDate: '2025-03-06' })])
  assert.equal(s.length, 0)
})

test('STALE latest price → stay quiet (beetroot not bought in 2 months)', () => {
  const s = signalsFor([mk({ name: 'Beetroot',
    doleLastPricePence: 700, dolePrevPricePence: 500,
    doleLastDateISO: '2026-04-21', dolePrevDate: '2026-04-15' })])
  assert.equal(s.length, 0)
})

test('reference older than 14 days → stay quiet (not a regular daily buy)', () => {
  const s = signalsFor([mk({ name: 'Strawberry',
    doleLastPricePence: 4000, dolePrevPricePence: 1600,
    doleLastDateISO: '2026-06-17', dolePrevDate: '2026-06-10' })])  // prev 19 days old
  assert.equal(s.length, 0)
})

test('bought twice within the last 2 weeks → shows the fluctuation', () => {
  const s = signalsFor([mk({ name: 'Onion Regular',
    doleLastPricePence: 1350, dolePrevPricePence: 1500,
    doleLastDateISO: '2026-06-28', dolePrevDate: '2026-06-24' })])
  assert.equal(s.length, 1)
  assert.equal(s[0].kind, 'down')
})

// ── Cross-supplier best price (computeBestSupplier mirror) ───────────────────
const BEST_MIN_GAP = 0.05, MAX_PLAUSIBLE_RATIO = 3
function bestSupplier(dole, holland, asOf = ASOF) {
  if (!dole || !holland || !dole.p || !holland.p) return null
  const da = ageDays(dole.date, asOf), ha = ageDays(holland.date, asOf)
  if (da === null || ha === null || da > MAX_LAST_AGE_DAYS || ha > MAX_LAST_AGE_DAYS) return null
  if (!dole.unitType || dole.unitType !== holland.unitType) return null
  const weight = dole.unitType === 'weight'
  const dDiv = weight ? dole.perKg : dole.perEach, hDiv = weight ? holland.perKg : holland.perEach
  if (!dDiv || !hDiv || dDiv <= 0 || hDiv <= 0) return null
  const dp = dole.p / dDiv, hp = holland.p / hDiv
  const lo = Math.min(dp, hp), hi = Math.max(dp, hp)
  if (hi / lo > MAX_PLAUSIBLE_RATIO) return null
  if ((hi - lo) / hi < BEST_MIN_GAP) return null
  return { winner: dp <= hp ? 'Dole' : 'Holland' }
}
const box = o => ({ p: null, date: '2026-06-27', unitType: 'weight', perEach: null, perKg: null, ...o })

test('per-kg: cheaper supplier wins (carrot Dole 70 vs Holland 130)', () => {
  const b = bestSupplier(box({ p: 700, perKg: 10 }), box({ p: 1300, perKg: 10 }))
  assert.equal(b.winner, 'Dole')
})

test('per-each: cucumber Holland 78 vs Dole 98 → Holland', () => {
  const b = bestSupplier(box({ p: 1568, unitType: 'count', perEach: 16, perKg: null }),
                         box({ p: 1092, unitType: 'count', perEach: 14, perKg: null }))
  assert.equal(b.winner, 'Holland')
})

test('absurd >3x gap → stay quiet (tomato 467 vs 116 = bad spec)', () => {
  const b = bestSupplier(box({ p: 2335, perKg: 5 }), box({ p: 580, perKg: 5 }))
  assert.equal(b, null)
})

test('mixed unit basis (count vs weight) → cannot compare', () => {
  const b = bestSupplier(box({ p: 700, unitType: 'count', perEach: 10, perKg: null }),
                         box({ p: 700, unitType: 'weight', perEach: null, perKg: 5 }))
  assert.equal(b, null)
})

test('one supplier stale (>14d) → no best-price claim', () => {
  const b = bestSupplier(box({ p: 700, perKg: 10, date: '2026-05-01' }), box({ p: 1300, perKg: 10 }))
  assert.equal(b, null)
})

test('prices within 5% → about the same, no recommendation', () => {
  const b = bestSupplier(box({ p: 700, perKg: 10 }), box({ p: 720, perKg: 10 }))
  assert.equal(b, null)
})
