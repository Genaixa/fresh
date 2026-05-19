import Anthropic from '@anthropic-ai/sdk'

export interface ParsedInvoiceItem {
  product_name_raw: string
  quantity: number
  unit_cost: number   // pence
  total_cost: number  // pence
}

export interface ParsedInvoice {
  supplier_name: string
  invoice_date: string  // ISO date string
  items: ParsedInvoiceItem[]
  raw_total: number | null  // pence
}

/**
 * Uses Claude's vision capability to extract line items from a market invoice PDF.
 * base64Pdf: the PDF file as a base64-encoded string.
 */
export async function parseInvoicePdf(base64Pdf: string): Promise<ParsedInvoice> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            type: 'text',
            text: `Extract all line items from this market produce invoice.
Return ONLY valid JSON in this exact shape — no markdown, no explanation:
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
- Convert all prices to pence (integers). £1.50 = 150, 45p = 45.
- If a price is per box or per kg, record it as given — do not convert units.
- If you cannot read a value, use null for that field.
- If the date is ambiguous, prefer DD/MM/YYYY interpretation (UK).`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

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
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned unparseable response: ${text.slice(0, 200)}`)
  }

  return {
    supplier_name: parsed.supplier_name ?? 'Unknown',
    invoice_date: parsed.invoice_date ?? new Date().toISOString().slice(0, 10),
    items: (parsed.items ?? []).map(item => ({
      product_name_raw: item.product_name_raw,
      quantity: item.quantity ?? 1,
      unit_cost: item.unit_cost_pence ?? 0,
      total_cost: item.total_cost_pence ?? 0,
    })),
    raw_total: parsed.raw_total_pence ?? null,
  }
}

/**
 * Fuzzy-match a raw product name against the catalogue.
 * Returns the best matching product_id or null.
 * Simple implementation: normalise + substring match.
 * Can be replaced with a proper Levenshtein impl later.
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
