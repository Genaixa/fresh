import OpenAI from 'openai'

// Default model — change via OPENROUTER_MODEL env var to swap without code changes
// Good options: google/gemini-2.0-flash, google/gemini-2.0-flash-lite, anthropic/claude-sonnet-4-6
const DEFAULT_MODEL = 'google/gemini-2.0-flash'

export interface ParsedInvoiceItem {
  product_name_raw: string
  quantity: number
  unit_cost: number   // pence
  total_cost: number  // pence
}

export interface ParsedInvoice {
  supplier_name: string
  invoice_date: string  // ISO date string YYYY-MM-DD
  items: ParsedInvoiceItem[]
  raw_total: number | null  // pence
}

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://freshandfruity.co.uk',
      'X-Title': 'Fresh & Fruity POS',
    },
  })
}

const PROMPT = `Extract all line items from this market produce invoice.
Return ONLY valid JSON — no markdown fences, no explanation:
{
  "supplier_name": "string",
  "invoice_date": "YYYY-MM-DD",
  "items": [
    {
      "product_name_raw": "exact name from invoice",
      "quantity": number,
      "unit_cost_pence": number,
      "total_cost_pence": number
    }
  ],
  "raw_total_pence": number or null
}

Rules:
- Convert all prices to integer pence. £1.50 = 150, 45p = 45.
- If a price is missing or unreadable, use 0.
- If the date is ambiguous, use DD/MM/YYYY interpretation (UK).
- Do not include VAT rows or subtotal rows as line items.`

/**
 * Parse a market invoice PDF using OpenRouter.
 * base64Pdf: the PDF as a base64-encoded string.
 */
export async function parseInvoicePdf(base64Pdf: string): Promise<ParsedInvoice> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL

  const response = await getClient().chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${base64Pdf}`,
            },
          },
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  })

  const text = response.choices[0]?.message?.content ?? ''

  // Strip markdown fences if model adds them despite instruction
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: {
    supplier_name: string
    invoice_date: string
    items: Array<{
      product_name_raw: string
      quantity: number
      unit_cost_pence: number
      total_cost_pence: number
    }>
    raw_total_pence: number | null
  }

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Model returned unparseable response: ${text.slice(0, 300)}`)
  }

  return {
    supplier_name: parsed.supplier_name ?? 'Unknown',
    invoice_date: parsed.invoice_date ?? new Date().toISOString().slice(0, 10),
    items: (parsed.items ?? []).map(item => ({
      product_name_raw: item.product_name_raw,
      quantity: item.quantity ?? 1,
      unit_cost:  item.unit_cost_pence  ?? 0,
      total_cost: item.total_cost_pence ?? 0,
    })),
    raw_total: parsed.raw_total_pence ?? null,
  }
}

/**
 * Fuzzy-match a raw product name against the catalogue.
 * Returns the best matching product_id or null.
 */
export function fuzzyMatchProduct(
  rawName: string,
  catalogue: Array<{ id: string; name: string }>
): string | null {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

  const needle = normalise(rawName)
  const tokens = needle.split(/\s+/)

  let bestId: string | null = null
  let bestScore = 0

  for (const product of catalogue) {
    const haystack = normalise(product.name)
    const matchedTokens = tokens.filter(t => haystack.includes(t))
    const score = matchedTokens.length / tokens.length

    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestId = product.id
    }
  }

  return bestId
}
