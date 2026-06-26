import OpenAI from 'openai'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MarketProduct } from './page'
import { CONFIG } from './config'
import { sendTelegram } from '@/lib/telegram'

export type GolemResult = {
  briefing: string | null
  tips: Record<string, string>
}

const EMPTY: GolemResult = { briefing: null, tips: {} }

// Quality first: the full gemini-2.5-flash (same model the invoice parser uses) is
// tried on its own and only falls back to the lighter/alt-provider models if it
// fails or stalls — so tip quality matches the original, which always used this
// model. The old list failed because gemini-2.0-flash-001 is dead ("No endpoints
// found") and the :free tiers return "Provider returned error".
// All three verified live + fast (~1.3s) on this key (18 Jun). NB: not all honour
// json_object response_format, so we don't request it and parse {...} defensively.
const QUALITY_MODEL   = 'google/gemini-2.5-flash'
const FALLBACK_MODELS = ['google/gemini-2.5-flash-lite', 'deepseek/deepseek-chat-v3-0324']

function cacheFile(suffix = '') {
  const today = new Date().toISOString().split('T')[0]
  return join(tmpdir(), `market-golem-${today}${suffix}.json`)
}

export async function generateMarketInsights(products: MarketProduct[]): Promise<GolemResult> {
  // Success cache — valid result from earlier today
  const successCache = cacheFile()
  if (existsSync(successCache)) {
    try { return JSON.parse(readFileSync(successCache, 'utf8')) } catch { /* fall through */ }
  }

  // Failure cache — all models failed recently, don't retry for 30 min
  const failCache = cacheFile('-fail')
  if (existsSync(failCache)) {
    try {
      const { ts } = JSON.parse(readFileSync(failCache, 'utf8'))
      if (Date.now() - ts < 30 * 60 * 1000) return EMPTY
    } catch { /* fall through */ }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey.startsWith('your_')) return EMPTY

  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })

  const month = new Date().toLocaleString('en-GB', { month: 'long' })
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // All figures PER UNIT (kg/each/punnet) from live invoice data — never per box —
  // so a 12kg apple box isn't judged against a 4kg-box budget. Supplier prices older
  // than 14 days are flagged STALE and must be ignored (e.g. a 2023 last price).
  const STALE_DAYS = 14
  const isStale = (d: string | null) =>
    d ? (Date.now() - new Date(d + 'T00:00:00').getTime()) / 86_400_000 > STALE_DAYS : false
  const lines = products.map(p => {
    const cfg = CONFIG[p.name]
    if (!cfg) return null
    const u = cfg.unitLabel
    const avgP = p.recentUnitAvgPence
    // >3x or <1/3 of the live avg = almost certainly a bad pack spec on that line
    // (whole box read as one unit).
    const implausible = (price: number) => !!avgP && (price > avgP * 3 || price < avgP * 0.33)
    // A price is only TRUSTWORTHY (comparable, advisable) if it's fresh AND plausible.
    // Untrustworthy prices are hidden as "no fresh price" — NOT shown with an "ignore"
    // label, because the model can't be relied on to honour "ignore" (it has called a
    // 4-month-stale £11/kg cucumber "Dole much higher" despite the tag). Don't hand it
    // the number at all.
    const trusted = (price: number | null, date: string | null): price is number =>
      !!price && !isStale(date) && !implausible(price)
    const dTrust = trusted(p.doleUnitPricePence, p.doleUnitDate)
    const hTrust = trusted(p.hollandUnitPricePence, p.hollandUnitDate)
    // Cross-supplier sanity: two individually-plausible prices that differ by >2.5x are
    // almost always a pack-spec MISMATCH (e.g. Dole loose-by-kg portobello £3.67 vs
    // Holland 12x250g punnet £0.72) — same avg-vs-price guard misses it (2.76x < 3x),
    // but the supplier-vs-supplier gap doesn't. Mark the dearer side SUSPECT so the
    // model never reads it as "supplier X is dearer, switch".
    let dSuspect = false, hSuspect = false
    if (dTrust && hTrust) {
      const d = p.doleUnitPricePence!, h = p.hollandUnitPricePence!
      if (Math.max(d, h) > Math.min(d, h) * 2.5) { if (d > h) dSuspect = true; else hSuspect = true }
    }
    const sup = (label: string, price: number | null, date: string | null, ok: boolean, suspect: boolean) =>
      !price ? `${label}: no price`
      : !ok ? `${label}: no fresh price`
      : suspect ? `${label} £${(price / 100).toFixed(2)}/${u} (SUSPECT pack-size mismatch — do NOT compare)`
      : `${label} £${(price / 100).toFixed(2)}/${u}${date ? ` (${date})` : ''}`
    const dole = sup('Dole', p.doleUnitPricePence, p.doleUnitDate, dTrust, dSuspect)
    const holl = sup('Holland', p.hollandUnitPricePence, p.hollandUnitDate, hTrust, hSuspect)
    const avg  = p.recentUnitAvgPence ? `recent avg £${(p.recentUnitAvgPence / 100).toFixed(2)}/${u}` : 'no recent avg'
    const max  = `max £${(p.maxUnitPence / 100).toFixed(2)}/${u}`
    const tags = [cfg.rareBuy ? '[seasonal]' : '', cfg.preferredSupplier ? `preferred:${cfg.preferredSupplier}` : ''].filter(Boolean).join(' ')
    return `${p.name}: sell £${(p.retailPricePence / 100).toFixed(2)}/${u}, ${max}, ${avg}, ${dole}, ${holl}${tags ? ' ' + tags : ''}`
  }).filter(Boolean).join('\n')

  const systemPrompt = `You are the Market Golem — a sharp, no-nonsense buying assistant for Fresh & Fruity, a greengrocer in Newcastle. Owner is David. Two suppliers: Dole Wholesale Gateshead and JR Holland.`
  const userPrompt   = `Today: ${today}\n\nAll prices are PER UNIT (kg/each/punnet), from live recent invoices. Only compare prices you are actually given a number for. "no fresh price" = that supplier has no recent, reliable price — never infer it is dearer or cheaper, just treat it as unknown. A price marked "SUSPECT pack-size mismatch" is bad data — IGNORE it completely: never compare it, never call a supplier dearer/cheaper because of it. For each product, write a 1-sentence tip ONLY when notable: a fresh price clearly above/below the recent avg, above max, or one supplier genuinely much cheaper (BOTH prices present and neither suspect). Skip normal items. Plain English, use £ amounts.\n\nAlso write a BRIEFING: 2 sentences on the most important real actions today — only cite products with a trustworthy fresh price, never a "no fresh price" or "SUSPECT" one.\n\nProducts:\n${lines}\n\nReturn ONLY valid JSON:\n{"briefing":"string","tips":{"Exact Product Name":"one sentence"}}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user'   as const, content: userPrompt   },
  ]

  // One model call → parsed JSON (or throws). Parse defensively: take the outermost
  // {...} so ```json fences / stray prose don't break it.
  const callModel = async (model: string) => {
    const r = await client.chat.completions.create({ model, messages, temperature: 0.2, stream: false })
    const content = r.choices[0]?.message?.content
    if (!content) throw new Error('empty')
    const start = content.indexOf('{')
    const end   = content.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('no JSON object')
    const parsed = JSON.parse(content.slice(start, end + 1))
    console.log(`[MarketGolem] success: ${model}`)
    return parsed
  }

  // Quality first: try gemini-2.5-flash on its own; only race the lighter fallbacks
  // if it errors. Whole thing capped at 15s (8s was too tight for the big prompt).
  const attempt = (async () => {
    try { return await callModel(QUALITY_MODEL) }
    catch (e) {
      console.warn(`[MarketGolem] ${QUALITY_MODEL} failed (${(e as Error).message}) — trying fallbacks`)
      return await Promise.any(FALLBACK_MODELS.map(callModel))
    }
  })()
  const result = await Promise.race([
    attempt.catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
  ])

  if (!result) {
    console.error('[MarketGolem] all models failed or timed out')
    try { writeFileSync(cacheFile('-fail'), JSON.stringify({ ts: Date.now() })) } catch { /* non-fatal */ }
    sendTelegram(`⚠️ <b>Market Golem failed</b>\nAll AI models timed out — no buying tips today. Check OpenRouter API key or try again later.`).catch(() => {})
    return EMPTY
  }

  const golemResult: GolemResult = {
    briefing: typeof result.briefing === 'string' ? result.briefing : null,
    tips:     typeof result.tips === 'object' && result.tips ? result.tips : {},
  }
  try { writeFileSync(successCache, JSON.stringify(golemResult)) } catch { /* non-fatal */ }

  if (golemResult.briefing) {
    sendTelegram(`🛒 <b>Market Golem — ${today}</b>\n${golemResult.briefing}`).catch(() => {})
  }

  return golemResult
}
