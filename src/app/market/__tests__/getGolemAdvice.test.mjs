/**
 * Unit tests for getGolemAdvice()
 * Run: node --test src/app/market/__tests__/getGolemAdvice.test.mjs
 *
 * Tagged: GOLEM-TEST — safe to delete once David is live.
 * No DB writes. Pure logic.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── Inline copy of the function under test ────────────────────────────────────
// Kept here so the test has no import issues with Next.js/TS internals.
// If getGolemAdvice() changes, update this copy.

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }

function daysAgo(dateStr) {
  if (!dateStr) return null
  const [d, m] = dateStr.split(' ')
  if (!d || !m || MONTHS[m] === undefined) return null
  const now  = new Date()
  const date = new Date(now.getFullYear(), MONTHS[m], parseInt(d))
  if (date > now) date.setFullYear(now.getFullYear() - 1)
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

function getGolemAdvice(entered, effectiveMax, lastPrice, otherLastPrice, otherLastDate, otherLabel, junAvg) {
  if (!entered || entered <= 0) return null
  const f   = (p) => `£${(p / 100).toFixed(2)}`
  const age = daysAgo(otherLastDate)
  const staleRef = age !== null && age > 14 ? ` (${otherLastDate})` : ''

  if (effectiveMax && entered > effectiveMax) {
    const over = entered - effectiveMax
    if (otherLastPrice && otherLastPrice < entered) {
      const within = otherLastPrice <= effectiveMax
      return {
        text: within
          ? `${f(over)} above max — ${otherLabel} was ${f(otherLastPrice)}${staleRef} last time, try them`
          : `${f(over)} above max — ${otherLabel} was ${f(otherLastPrice)}${staleRef} last time`,
        tone: 'warn',
      }
    }
    return { text: `${f(over)} above max — negotiate or skip`, tone: 'warn' }
  }

  if (lastPrice && lastPrice > 0) {
    const change = entered - lastPrice
    const pct = Math.abs(change) / lastPrice
    if (pct >= 0.10) {
      if (change > 0) return { text: `Up ${f(change)} from last time (was ${f(lastPrice)})`, tone: 'warn' }
      return { text: `Down ${f(Math.abs(change))} from last time — good`, tone: 'good' }
    }
  }

  if (otherLastPrice && otherLastPrice > 0) {
    const diff = entered - otherLastPrice
    const pct = diff / otherLastPrice
    if (pct > 0.15) {
      return { text: `${Math.round(pct * 100)}% more than ${otherLabel}'s last price of ${f(otherLastPrice)}${staleRef}`, tone: 'info' }
    }
  }

  if (junAvg && junAvg > 0) {
    const pct = (entered - junAvg) / junAvg
    if (pct < -0.15) return { text: `${Math.round(Math.abs(pct) * 100)}% below June avg — buy more than usual`, tone: 'good' }
    if (pct > 0.20)  return { text: `${Math.round(pct * 100)}% above June avg — buy less than usual`, tone: 'warn' }
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) // e.g. "3 Jun"
const RECENT = TODAY   // same day = 0 days ago
const STALE  = '16 Feb' // always >14 days ago

// ── Normal scenarios ──────────────────────────────────────────────────────────

describe('Normal — no advice expected', () => {
  test('no price entered → null', () => {
    assert.equal(getGolemAdvice(0, 702, 500, 500, RECENT, 'Holland', 450), null)
  })

  test('price within 10% of last, within max, within avg → null', () => {
    // Carrot Loose: Dole £8.50, Holland £8.00 (6% cheaper — below 15% threshold)
    assert.equal(getGolemAdvice(850, 1000, 850, 800, RECENT, 'Holland', 850), null)
  })

  test('price exactly at max → null', () => {
    // No junAvg passed so only max/lastPrice signals are checked — both quiet
    assert.equal(getGolemAdvice(702, 702, 700, null, null, 'Holland', null), null)
  })

  test('price 9% above seasonal avg (below 20% threshold) → null', () => {
    assert.equal(getGolemAdvice(491, 702, 500, null, null, 'Holland', 450), null)
  })

  test('other supplier 14% cheaper (below 15% threshold) → null', () => {
    assert.equal(getGolemAdvice(570, 702, 570, 500, RECENT, 'Holland', null), null)
  })
})

// ── Above max scenarios ───────────────────────────────────────────────────────

describe('Above max', () => {
  test('above max, no other supplier → negotiate or skip', () => {
    const a = getGolemAdvice(1700, 702, 1700, null, null, 'Holland', 450)
    assert.equal(a?.tone, 'warn')
    assert.match(a?.text, /negotiate or skip/)
    assert.match(a?.text, /£9.98 above max/)
  })

  test('above max, other supplier within max → try them (recent date, no suffix)', () => {
    // Tomato Cherry: Dole £17, max £7.02, Holland last £5 (recent)
    const a = getGolemAdvice(1700, 702, 1700, 500, RECENT, 'Holland', 450)
    assert.equal(a?.tone, 'warn')
    assert.match(a?.text, /try them/)
    assert.match(a?.text, /Holland was £5\.00/)
    assert.doesNotMatch(a?.text, /Feb|Jan|Mar|Apr/) // no stale date suffix
  })

  test('above max, other supplier also above max → reference but no try them', () => {
    // Both above max — Holland was £8 which is still above £7.02 max
    const a = getGolemAdvice(1700, 702, 1700, 800, RECENT, 'Holland', 450)
    assert.equal(a?.tone, 'warn')
    assert.doesNotMatch(a?.text, /try them/)
    assert.match(a?.text, /Holland was £8\.00/)
  })

  test('above max, other supplier stale → shows date suffix', () => {
    const a = getGolemAdvice(1700, 702, 1700, 500, STALE, 'Holland', 450)
    assert.match(a?.text, /\(16 Feb\)/)
  })

  test('above max, other supplier more expensive → no mention of other (our price still above max)', () => {
    const a = getGolemAdvice(1700, 702, 1700, 2000, RECENT, 'Holland', 450)
    assert.match(a?.text, /negotiate or skip/)
    assert.doesNotMatch(a?.text, /Holland/)
  })
})

// ── Price change vs last visit ────────────────────────────────────────────────

describe('Price change vs last visit', () => {
  test('10% price rise → Up warning', () => {
    const a = getGolemAdvice(550, 1000, 500, null, null, 'Holland', null)
    assert.equal(a?.tone, 'warn')
    assert.match(a?.text, /Up £0\.50 from last time/)
    assert.match(a?.text, /was £5\.00/)
  })

  test('10% price drop → Down good news', () => {
    const a = getGolemAdvice(450, 1000, 500, null, null, 'Holland', null)
    assert.equal(a?.tone, 'good')
    assert.match(a?.text, /Down £0\.50 from last time/)
  })

  test('9% change (just under threshold) → null', () => {
    const a = getGolemAdvice(545, 1000, 500, null, null, 'Holland', null)
    assert.equal(a, null)
  })

  test('price change wins over seasonal avg comparison', () => {
    // Price up 20% from last time AND above avg — should report the price change, not the avg
    const a = getGolemAdvice(1200, 2000, 1000, null, null, 'Holland', 900)
    assert.match(a?.text, /Up £2\.00 from last time/)
  })
})

// ── Supplier comparison ───────────────────────────────────────────────────────

describe('Supplier cost comparison', () => {
  test('16% more than other supplier (recent) → info, no date', () => {
    // Onion: Dole £15, Holland last £8.20 (recent) — that's 83% more
    const a = getGolemAdvice(1500, 1800, 1500, 820, RECENT, 'Holland', null)
    assert.equal(a?.tone, 'info')
    assert.match(a?.text, /83%/)
    assert.match(a?.text, /Holland's last price of £8\.20/)
    assert.doesNotMatch(a?.text, /Feb|Jan/) // no stale date
  })

  test('16% more than other supplier (stale) → info with date suffix', () => {
    const a = getGolemAdvice(1500, 1800, 1500, 820, STALE, 'Holland', null)
    assert.equal(a?.tone, 'info')
    assert.match(a?.text, /\(16 Feb\)/)
  })

  test('15% or less more → null (below threshold)', () => {
    // 14.9% more
    const a = getGolemAdvice(575, 1000, 575, 500, RECENT, 'Holland', null)
    assert.equal(a, null)
  })

  test('this supplier cheaper than other → null (only warn when we are more expensive)', () => {
    const a = getGolemAdvice(500, 1000, 500, 820, RECENT, 'Holland', null)
    assert.equal(a, null)
  })
})

// ── Seasonal average ──────────────────────────────────────────────────────────

describe('Seasonal average comparison', () => {
  test('16% below avg → buy more', () => {
    // Leek Dole £5, June avg £12.50 box → 60% below
    const a = getGolemAdvice(500, 1000, 500, null, null, 'Holland', 1250)
    assert.equal(a?.tone, 'good')
    assert.match(a?.text, /60% below June avg/)
    assert.match(a?.text, /buy more than usual/)
  })

  test('21% above avg → buy less', () => {
    const a = getGolemAdvice(545, 1000, 545, null, null, 'Holland', 450)
    assert.equal(a?.tone, 'warn')
    assert.match(a?.text, /21% above June avg/)
    assert.match(a?.text, /buy less than usual/)
  })

  test('exactly 20% above avg (at threshold) → null', () => {
    const a = getGolemAdvice(540, 1000, 540, null, null, 'Holland', 450)
    assert.equal(a, null)
  })

  test('no seasonal avg → null (not enough data)', () => {
    const a = getGolemAdvice(500, 1000, 500, null, null, 'Holland', null)
    assert.equal(a, null)
  })
})

// ── Chaos scenarios ───────────────────────────────────────────────────────────

describe('Chaos scenarios', () => {
  test('price is 10× the max → above max with correct £ amount', () => {
    // 10000 - 702 = 9298p = £92.98
    const a = getGolemAdvice(10000, 702, 10000, null, null, 'Holland', 450)
    assert.match(a?.text, /£92\.98 above max/)
  })

  test('both suppliers same price → no supplier comparison advice', () => {
    const a = getGolemAdvice(500, 1000, 500, 500, RECENT, 'Holland', null)
    assert.equal(a, null)
  })

  test('no prior price from either supplier, within max, no avg → null', () => {
    const a = getGolemAdvice(500, 1000, null, null, null, 'Holland', null)
    assert.equal(a, null)
  })

  test('negative entered price → null (defensive)', () => {
    const a = getGolemAdvice(-100, 702, 500, null, null, 'Holland', 450)
    assert.equal(a, null)
  })

  test('effectiveMax is 0 (unconfigured) → no above-max warning', () => {
    // max 0 should not trigger above-max
    const a = getGolemAdvice(500, 0, 500, null, null, 'Holland', null)
    assert.equal(a, null)
  })

  test('box count override: watermelon 4s instead of 9s → max scales correctly', () => {
    // maxPayPerUnitPence=244, default 9 → max=2196. Override to 4 → max=976
    // At £10 (1000p) with 4-box: 1000 > 976 → above max
    const effectiveMaxFor4 = Math.round(244 * 4) // 976
    const a = getGolemAdvice(1000, effectiveMaxFor4, 1000, null, null, 'Holland', null)
    assert.equal(a?.tone, 'warn')
    assert.match(a?.text, /above max/)
  })

  test('watermelon 9-box at same price → within max', () => {
    const effectiveMaxFor9 = Math.round(244 * 9) // 2196
    const a = getGolemAdvice(1000, effectiveMaxFor9, 1000, null, null, 'Holland', null)
    assert.equal(a, null)
  })

  test('stale date that would be in the future this year → assigned to previous year', () => {
    // Dec date should be treated as last December, not next December
    const dec = '25 Dec'
    const days = daysAgo(dec)
    assert.ok(days !== null && days > 0, `Expected positive days, got ${days}`)
  })

  test('priority: above max beats price-change beats supplier comparison beats avg', () => {
    // All signals present — above max should win
    const a = getGolemAdvice(
      1700,  // entered
      702,   // max
      500,   // last (so 240% up from last = price change signal)
      400,   // other last (so 325% more = supplier signal)
      RECENT,
      'Holland',
      450    // avg (so 278% above avg = avg signal)
    )
    assert.match(a?.text, /above max/) // above max wins
  })
})
