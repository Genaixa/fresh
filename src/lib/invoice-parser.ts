import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

// Default model — change via OPENROUTER_MODEL env var to swap without code changes
// Good options: google/gemini-2.5-flash, google/gemini-2.0-flash-001, anthropic/claude-sonnet-4-6
const DEFAULT_MODEL = 'google/gemini-2.5-flash'

export interface ParsedInvoiceItem {
  product_name_raw: string
  brand_raw: string             // Brand column from Dole delivery notes
  quantity: number
  unit_cost: number             // pence (per box/case as purchased)
  total_cost: number            // pence
  unit_type: 'count' | 'weight' // how the box is sold
  units_per_case: number | null // retail units per box (count-based items only)
  box_weight_kg: number | null  // kg per box (weight-based items only)
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

const PROMPT = `You are reading a Dole/Total Produce Delivery Note/Invoice for a greengrocer.
The document has these columns: Qty | Units | Product Description | Brand | VAT | Price | Value

Extract all line items. Return ONLY valid JSON — no markdown fences, no explanation:
{
  "supplier_name": "string",
  "invoice_date": "YYYY-MM-DD",
  "items": [
    {
      "product_name_raw": "exact Product Description text from invoice",
      "brand_raw": "exact Brand text, empty string if blank",
      "quantity": number,
      "unit_cost_pence": number,
      "total_cost_pence": number,
      "unit_type": "count" or "weight",
      "units_per_case": number or null,
      "box_weight_kg": number or null
    }
  ],
  "raw_total_pence": number or null
}

Rules:
- Convert all prices to integer pence. £10.50 → 1050. Price is per box (per line).
- Date: use DD/MM/YYYY interpretation (UK dates).
- Do NOT include VAT rows, subtotals, or Total lines as items.
- Skip the "BAGS PLASTIC" line if present.

Box spec rules — read BOTH Product Description AND Brand column:
- "24X500ML" in description → unit_type="count", units_per_case=24, box_weight_kg=null
- "16X250G" or "10X500G" → unit_type="count", units_per_case=16 (or 10)
- "10X2KG" or "15X1KG" → unit_type="count", units_per_case=10 (or 15)
- "X15'S" or "X25'S" or "X14" in Brand → unit_type="count", units_per_case=15 (or 25/14)
- "12KG" or "25KG" alone in description → unit_type="weight", box_weight_kg=12 (or 25), units_per_case=null
- "8" or "18" as the only number at end of description (PINEAPPLE . COSTA RICA 8) → unit_type="count", units_per_case=8
- Numbers like 30, 40, 66, 70, 74, 80 before a country code or KG are SIZE GRADES, not counts — ignore them
- "18.2KG" → unit_type="weight", box_weight_kg=18.2
- If you cannot determine box spec, set unit_type="count", units_per_case=1, box_weight_kg=null`

/**
 * Parse a market invoice PDF using OpenRouter.
 * base64Pdf: the PDF as a base64-encoded string.
 */
export async function parseInvoicePdf(base64Pdf: string): Promise<ParsedInvoice> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL

  const response = await getClient().chat.completions.create({
    model,
    max_tokens: 8192,
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

  // Extract the outermost JSON object — handles markdown fences, leading text, etc.
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Model returned no JSON object: ${text.slice(0, 300)}`)
  }

  let parsed: {
    supplier_name: string
    invoice_date: string
    items: Array<{
      product_name_raw: string
      brand_raw: string
      quantity: number
      unit_cost_pence: number
      total_cost_pence: number
      unit_type: 'count' | 'weight'
      units_per_case: number | null
      box_weight_kg: number | null
    }>
    raw_total_pence: number | null
  }

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Model returned unparseable JSON: ${jsonMatch[0].slice(0, 300)}`)
  }

  return {
    supplier_name: parsed.supplier_name ?? 'Unknown',
    invoice_date: parsed.invoice_date ?? new Date().toISOString().slice(0, 10),
    items: (parsed.items ?? []).map(item => ({
      product_name_raw: item.product_name_raw,
      brand_raw:        item.brand_raw        ?? '',
      quantity:         item.quantity         ?? 1,
      unit_cost:        item.unit_cost_pence  ?? 0,
      total_cost:       item.total_cost_pence ?? 0,
      unit_type:        item.unit_type        ?? 'count',
      units_per_case:   item.units_per_case   ?? null,
      box_weight_kg:    item.box_weight_kg    ?? null,
    })),
    raw_total: parsed.raw_total_pence ?? null,
  }
}

/** Normalise a supplier name for consistent mapping keys */
export function normaliseSupplierName(name: string): string {
  return name.toLowerCase().replace(/\./g, '').trim().replace(/\s+/g, ' ')
}

export interface MappingResult {
  product_id: string
  unit_type: 'count' | 'weight' | null
  units_per_case: number | null
  box_weight_kg: number | null
}

/**
 * Look up a raw invoice description in the supplier_product_mappings table.
 * Returns the full mapping (product + confirmed box spec) if found.
 */
export async function lookupMapping(
  supabase: SupabaseClient,
  supplierName: string,
  rawDescription: string
): Promise<MappingResult | null> {
  const { data } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, match_count, unit_type, units_per_case, box_weight_kg')
    .eq('supplier_name', normaliseSupplierName(supplierName))
    .eq('raw_description', rawDescription)
    .eq('status', 'confirmed')
    .not('product_id', 'is', null)
    .single()

  if (!data?.product_id) return null

  // Bump usage counter (fire-and-forget)
  supabase
    .from('supplier_product_mappings')
    .update({ match_count: data.match_count + 1 })
    .eq('supplier_name', normaliseSupplierName(supplierName))
    .eq('raw_description', rawDescription)
    .then(() => {})

  return {
    product_id:     data.product_id,
    unit_type:      data.unit_type as 'count' | 'weight' | null,
    units_per_case: data.units_per_case,
    box_weight_kg:  data.box_weight_kg,
  }
}

export interface BoxSpec {
  unit_type?: 'count' | 'weight' | null
  units_per_case?: number | null
  box_weight_kg?: number | null
  last_price_p?: number | null
}

/**
 * Save a supplier→product mapping. Upserts — if exists, bumps match_count.
 * confirmedBy: user UUID if human-confirmed, null if auto-matched.
 */
export async function saveMapping(
  supabase: SupabaseClient,
  supplierName: string,
  rawDescription: string,
  productId: string,
  confirmedBy: string | null = null,
  boxSpec?: BoxSpec
): Promise<void> {
  await supabase
    .from('supplier_product_mappings')
    .upsert(
      {
        supplier_name:   normaliseSupplierName(supplierName),
        raw_description: rawDescription,
        product_id:      productId,
        confirmed_by:    confirmedBy,
        status:          confirmedBy ? 'confirmed' : 'confirmed',
        ...(boxSpec?.unit_type     !== undefined && { unit_type:      boxSpec.unit_type }),
        ...(boxSpec?.units_per_case !== undefined && { units_per_case: boxSpec.units_per_case }),
        ...(boxSpec?.box_weight_kg  !== undefined && { box_weight_kg:  boxSpec.box_weight_kg }),
        ...(boxSpec?.last_price_p   !== undefined && { last_price_p:   boxSpec.last_price_p }),
      },
      {
        onConflict: 'supplier_name,raw_description',
        ignoreDuplicates: false,
      }
    )
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

  let bestId: string | null = null
  let bestScore = 0

  for (const product of catalogue) {
    const haystack = normalise(product.name)
    // Score by how many of the SHORT catalogue name tokens appear in the
    // LONG invoice name — not the other way around. Invoice names carry
    // extra country/size/packaging tokens that shouldn't dilute the score.
    const catalogueTokens = haystack.split(/\s+/).filter(t => t.length > 1)
    const matched = catalogueTokens.filter(t => needle.includes(t))
    const score = matched.length / catalogueTokens.length

    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestId = product.id
    }
  }

  return bestId
}
