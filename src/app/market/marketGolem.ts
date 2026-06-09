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

// All tried in parallel — first to succeed wins, rest are cancelled
const MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

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

  const lines = products.map(p => {
    const cfg = CONFIG[p.name]
    if (!cfg) return null
    const dole = p.doleLastPricePence
      ? `Dole £${(p.doleLastPricePence / 100).toFixed(2)}/box${p.doleLastDate ? ` (${p.doleLastDate})` : ''}`
      : 'Dole: no price'
    const holl = p.hollandLastPricePence
      ? `Holland £${(p.hollandLastPricePence / 100).toFixed(2)}/box${p.hollandLastDate ? ` (${p.hollandLastDate})` : ''}`
      : 'Holland: no price'
    const avg  = p.junAvgBoxPricePence ? `${month} avg £${(p.junAvgBoxPricePence / 100).toFixed(2)}/box` : 'no seasonal avg'
    const tags = [cfg.rareBuy ? '[seasonal]' : '', cfg.preferredSupplier ? `preferred:${cfg.preferredSupplier}` : ''].filter(Boolean).join(' ')
    return `${p.name}: sell £${(p.retailPricePence / 100).toFixed(2)}/${cfg.unitLabel}, case ${cfg.typicalBoxCount} ${cfg.unitLabel}, max £${(p.maxBoxPricePence / 100).toFixed(2)}/box, ${avg}, ${dole}, ${holl}${tags ? ' ' + tags : ''}`
  }).filter(Boolean).join('\n')

  const systemPrompt = `You are the Market Golem — a sharp, no-nonsense buying assistant for Fresh & Fruity, a greengrocer in Newcastle. Owner is David. Two suppliers: Dole Wholesale Gateshead and JR Holland.`
  const userPrompt   = `Today: ${today}\n\nFor each product, write a 1-sentence tip ONLY when notable: price vs avg, above max, one supplier much cheaper, seasonal opportunity. Skip normal items. Plain English, use £ amounts.\n\nAlso write a BRIEFING: 2 sentences on the most important actions today.\n\nProducts:\n${lines}\n\nReturn ONLY valid JSON:\n{"briefing":"string","tips":{"Exact Product Name":"one sentence"}}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user'   as const, content: userPrompt   },
  ]

  // Race all models in parallel — 8s hard limit
  const result = await Promise.race([
    Promise.any(
      MODELS.map(model =>
        client.chat.completions.create({ model, messages, response_format: { type: 'json_object' }, temperature: 0.2, stream: false })
          .then(r => {
            const content = r.choices[0]?.message?.content
            if (!content) throw new Error('empty')
            const parsed = JSON.parse(content)
            console.log(`[MarketGolem] success: ${model}`)
            return parsed
          })
      )
    ).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
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
