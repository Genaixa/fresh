import OpenAI from 'openai'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MarketProduct } from './page'
import { computeSignals, briefingFromSignals, signalProducts } from './marketSignals'
import { sendTelegram } from '@/lib/telegram'

export type GolemResult = {
  briefing: string | null
  tips: Record<string, string>
}

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
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── Step 1: FACTS (deterministic, always correct) ──────────────────────────
  // The set of claims is fixed here in code. Everything downstream can only
  // rephrase these — never add or contradict them.
  const signals   = computeSignals(products)
  const allowed   = signalProducts(signals)
  const templated = briefingFromSignals(signals)   // the always-correct baseline

  // Success cache — valid (LLM-polished) result from earlier today.
  const successCache = cacheFile()
  if (existsSync(successCache)) {
    try { return JSON.parse(readFileSync(successCache, 'utf8')) } catch { /* fall through */ }
  }
  // Failure cache — LLM failed recently. Still serve the deterministic briefing
  // (not nothing): the facts don't need the model.
  const failCache = cacheFile('-fail')
  if (existsSync(failCache)) {
    try {
      const { ts } = JSON.parse(readFileSync(failCache, 'utf8'))
      if (Date.now() - ts < 30 * 60 * 1000) return templated
    } catch { /* fall through */ }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey.startsWith('your_')) return templated   // no LLM → deterministic prose

  // ── Step 2: PHRASING (optional LLM polish, validated against the facts) ─────
  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })

  const systemPrompt = `You are the Market Golem — a sharp, no-nonsense buying assistant for Fresh & Fruity, a greengrocer in Newcastle. Owner is David. Two suppliers: Dole Wholesale Gateshead and JR Holland.`
  const userPrompt   = `Today: ${today}\n\nBelow is a list of VERIFIED buying signals — these are the ONLY facts you may use. Do NOT mention any product, supplier, or price that is not in this list. Do NOT invent comparisons. Your job is purely to phrase these nicely, not to add analysis.\n\nSignals (JSON):\n${JSON.stringify(signals.map(s => ({ product: s.product, point: s.text })), null, 0)}\n\nWrite:\n- "briefing": 1-2 sentences naming the 2-4 most important items from the signals above (best buys + things to watch). Only products that appear in the signals.\n- "tips": an object mapping each product name (exactly as written) to a one-sentence version of its signal.\n\nReturn ONLY valid JSON: {"briefing":"string","tips":{"Exact Product Name":"one sentence"}}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user'   as const, content: userPrompt   },
  ]

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
    console.error('[MarketGolem] all models failed or timed out — serving deterministic briefing')
    try { writeFileSync(cacheFile('-fail'), JSON.stringify({ ts: Date.now() })) } catch { /* non-fatal */ }
    return templated   // deterministic advice still stands
  }

  // ── Step 3: VALIDATE the prose against the facts ───────────────────────────
  // Tips: keep only products that genuinely have a signal (scope from code, words
  // from the LLM). Backfill any signal the LLM skipped from the deterministic text.
  const llmTips: Record<string, string> = (typeof result.tips === 'object' && result.tips) ? result.tips : {}
  const tips: Record<string, string> = {}
  for (const [name, text] of Object.entries(llmTips))
    if (allowed.has(name) && typeof text === 'string') tips[name] = text
  for (const [name, text] of Object.entries(templated.tips))
    if (!tips[name]) tips[name] = text   // never drop a real signal

  // Briefing: reject it if it names any product that has NO signal (the exact
  // failure we're guarding — "focus on Pink Lady" when Pink Lady has no signal).
  // On rejection, fall back to the deterministic briefing.
  let briefing = typeof result.briefing === 'string' ? result.briefing : null
  if (briefing) {
    const namesAProductWithoutSignal = products
      .map(p => p.name)
      .some(n => !allowed.has(n) && briefing!.includes(n))
    if (namesAProductWithoutSignal) {
      console.warn('[MarketGolem] briefing cited a no-signal product — using deterministic briefing')
      briefing = templated.briefing
    }
  } else {
    briefing = templated.briefing
  }

  const golemResult: GolemResult = { briefing, tips }
  try { writeFileSync(successCache, JSON.stringify(golemResult)) } catch { /* non-fatal */ }

  if (golemResult.briefing) {
    sendTelegram(`🛒 <b>Market Golem — ${today}</b>\n${golemResult.briefing}`).catch(() => {})
  }

  return golemResult
}
