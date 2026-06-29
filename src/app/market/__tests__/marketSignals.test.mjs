/**
 * Unit tests for computeSignals() — box-price-vs-last-buy model + recency guard.
 * Run: node --test src/app/market/__tests__/marketSignals.test.mjs
 * Convention: logic mirrored inline (no TS loader). Update if marketSignals.ts changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const THRESHOLD = 0.10
const MAX_LAST_AGE_DAYS = 14
const MAX_PREV_AGE_DAYS = 60
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

test('recent buy with ~3-week-old reference still promotes (strawberry spike survives)', () => {
  const s = signalsFor([mk({ name: 'Strawberry',
    doleLastPricePence: 4000, dolePrevPricePence: 1600,
    doleLastDateISO: '2026-06-17', dolePrevDate: '2026-06-10' })])
  assert.equal(s.length, 1)
  assert.equal(s[0].kind, 'up')
})
