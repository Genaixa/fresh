/**
 * Unit tests for computeSignals() — box-price-vs-last-buy model.
 * Run: node --test src/app/market/__tests__/marketSignals.test.mjs
 *
 * Convention (same as getGolemAdvice.test.mjs): logic mirrored inline so it runs
 * under plain `node --test` with no TS loader. If marketSignals.ts changes, update.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

const THRESHOLD = 0.10
function signalsFor(products) {
  const out = []
  for (const p of products) {
    const cands = []
    if (p.doleLastPricePence && p.dolePrevPricePence) cands.push({ s: 'Dole', last: p.doleLastPricePence, prev: p.dolePrevPricePence })
    if (p.hollandLastPricePence && p.hollandPrevPricePence) cands.push({ s: 'Holland', last: p.hollandLastPricePence, prev: p.hollandPrevPricePence })
    if (!cands.length) continue
    const pick = cands.reduce((a, b) => (b.last < a.last ? b : a))
    const pct = (pick.last - pick.prev) / pick.prev
    if (Math.abs(pct) < THRESHOLD) continue
    out.push({ product: p.name, kind: pct < 0 ? 'down' : 'up', pct, supplier: pick.s })
  }
  return out
}
const mk = o => ({ doleLastPricePence: null, dolePrevPricePence: null, hollandLastPricePence: null, hollandPrevPricePence: null, ...o })

test('price jump since last buy → up signal (strawberry)', () => {
  const s = signalsFor([mk({ name: 'Strawberry', doleLastPricePence: 4000, dolePrevPricePence: 1600 })])
  assert.equal(s.length, 1)
  assert.equal(s[0].kind, 'up')
})

test('price drop since last buy → down signal (royal gala)', () => {
  const s = signalsFor([mk({ name: 'Apple Royal Gala', doleLastPricePence: 1200, dolePrevPricePence: 2200 })])
  assert.equal(s[0].kind, 'down')
})

test('no previous price → no signal (cannot compare dates)', () => {
  const s = signalsFor([mk({ name: 'Leek', doleLastPricePence: 700, dolePrevPricePence: null })])
  assert.equal(s.length, 0)
})

test('move under 10% is not notable', () => {
  const s = signalsFor([mk({ name: 'Tomato', doleLastPricePence: 580, dolePrevPricePence: 560 })])
  assert.equal(s.length, 0)
})

test('represents product by the cheaper current supplier', () => {
  const s = signalsFor([mk({ name: 'Onion Spanish',
    doleLastPricePence: 1200, dolePrevPricePence: 1200,        // flat, dearer
    hollandLastPricePence: 820, hollandPrevPricePence: 1200 })]) // cheaper, dropped 32%
  assert.equal(s[0].supplier, 'Holland')
  assert.equal(s[0].kind, 'down')
})
