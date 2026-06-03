import OpenAI from 'openai'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export type CfoGolemInput = {
  weekLabel:      string   // e.g. "28 May – 3 Jun"
  thisWeekSpend:  number   // pence
  lastWeekSpend:  number   // pence
  thisWeekMargin: number   // 0–1
  lastWeekMargin: number   // 0–1
  losingMoney:    { name: string; margin: number; costPerUnit: number; retailPerUnit: number }[]
  topSpends:      { name: string; spend: number; boxes: number; margin: number }[]
  priceAlerts:    { name: string; paidPerBox: number; lastSetPerBox: number; changePct: number }[]
}

const MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

function cacheFile() {
  const today = new Date().toISOString().split('T')[0]
  return join(tmpdir(), `cfo-golem-${today}.json`)
}

function failFile() {
  const today = new Date().toISOString().split('T')[0]
  return join(tmpdir(), `cfo-golem-${today}-fail.json`)
}

export async function generateCfoBriefing(input: CfoGolemInput): Promise<string | null> {
  const cf = cacheFile()
  if (existsSync(cf)) {
    try { return JSON.parse(readFileSync(cf, 'utf8')).briefing } catch { /* regenerate */ }
  }

  const ff = failFile()
  if (existsSync(ff)) {
    try {
      const { ts } = JSON.parse(readFileSync(ff, 'utf8'))
      if (Date.now() - ts < 30 * 60 * 1000) return null
    } catch { /* regenerate */ }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey.startsWith('your_')) return null

  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })

  const f  = (p: number) => `£${(p / 100).toFixed(2)}`
  const pct = (n: number) => `${Math.round(n * 100)}%`

  const lines = [
    `Week: ${input.weekLabel}`,
    `Spend this week: ${f(input.thisWeekSpend)} (last week: ${f(input.lastWeekSpend)}, ${input.thisWeekSpend > input.lastWeekSpend ? 'up' : 'down'} ${f(Math.abs(input.thisWeekSpend - input.lastWeekSpend))})`,
    `Theoretical margin this week: ${pct(input.thisWeekMargin)} (last week: ${pct(input.lastWeekMargin)})`,
    input.losingMoney.length
      ? `LOSING MONEY on: ${input.losingMoney.map(l => `${l.name} (paying ${f(l.costPerUnit)}, selling ${f(l.retailPerUnit)}, margin ${pct(l.margin)})`).join('; ')}`
      : 'No products losing money this week.',
    `Top spends: ${input.topSpends.slice(0, 5).map(t => `${t.name} ${f(t.spend)} / ${t.boxes} boxes / ${pct(t.margin)} margin`).join('; ')}`,
    input.priceAlerts.length
      ? `Purchase cost changed significantly vs last retail set: ${input.priceAlerts.map(a => `${a.name} up ${Math.round(a.changePct)}%`).join('; ')}`
      : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are the CFO Golem for Fresh & Fruity, a Newcastle greengrocer. Owner is David (ADHD — keep it short and direct).

Data for this week:
${lines}

Write a CFO briefing in 3 sentences max. Tell David:
1. How the week looks overall (spend vs last week, margin direction)
2. The single most important thing to act on (losing money, price fix, or big opportunity)
3. One positive if there is one

Plain English. Use £ amounts. No jargon. No bullet points — flowing sentences.`

  const result = await Promise.race([
    Promise.any(
      MODELS.map(model =>
        client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          stream: false,
          max_tokens: 150,
        }).then(r => {
          const text = r.choices[0]?.message?.content?.trim()
          if (!text) throw new Error('empty')
          return text
        })
      )
    ).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
  ])

  if (!result) {
    try { writeFileSync(failFile(), JSON.stringify({ ts: Date.now() })) } catch { /* non-fatal */ }
    return null
  }

  try { writeFileSync(cacheFile(), JSON.stringify({ briefing: result })) } catch { /* non-fatal */ }
  return result
}
