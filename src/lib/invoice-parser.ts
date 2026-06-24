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
  invoice_number: string | null  // Ticket No / Delivery No — used to detect duplicates
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

const PROMPT = `You are reading a delivery note / invoice from one of the shop's suppliers: Total Produce/Dole, JR Holland, Thomas Baty, or The Milk Company.
Most are produce notes with columns: Qty | Units | Product Description | Brand | VAT | Price | Value.
The Milk Company invoice looks different — see the milk rule below.

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
  "raw_total_pence": number or null,
  "invoice_number": "string or null"
}

CRITICAL — which total to use for raw_total_pence:
- raw_total_pence MUST be the EX-VAT goods amount, i.e. the "Sub Total" line (the sum of the Value column / all line items).
- It must NOT be the VAT-inclusive grand "Total" line. These Dole/Total Produce notes print BOTH: "Sub Total: GBP 475.90", "VAT: GBP 12.00", "Total: GBP 487.90" — take 475.90 (the Sub Total), never 487.90.
- If only one total is printed (no separate VAT line, or VAT is 0), use that.
- Sanity check: raw_total_pence should equal the sum of every line's total_cost_pence. If it doesn't, you have likely picked the VAT-inclusive Total — switch to the Sub Total.

Rules:
- Convert all prices to integer pence. £10.50 → 1050. Price is per box (per line).
- Date: use DD/MM/YYYY interpretation (UK dates).
- Do NOT include VAT rows, subtotals, or Total lines as items.
- invoice_number: the "Ticket No" (e.g. 2744185) or the Dole "No" / "Delivery No" (e.g. 11230791) or, for milk, the "Invoice No." (e.g. 20019). null if none found.
- THE MILK COMPANY invoices are a weekly grid: rows like "Whole" and "Semi" milk, daily columns (Sun..Fri), a weekly Qty, and a per-unit Price (e.g. "160 @ 1.29000 = 206.40"). For each milk row emit one item: product_name_raw = the milk type as printed ("Whole" / "Semi"), quantity = the weekly Qty (160 / 80), unit_cost_pence = the per-unit price (1.29 → 129), total_cost_pence = the line Value, unit_type="count", units_per_case=1, box_weight_kg=null. invoice_number = the "Invoice No." (20019). invoice_date = the "Week Ending" / "Date" (DD/MM/YY UK). raw_total_pence = the "Weeks Total" (milk is zero-rated, so no VAT line).
- Include EVERY line item — including non-produce lines like carrier bags, water, plastic — so the line values add up to the printed total. Do not skip any line.

Box spec rules — read BOTH Product Description AND Brand column:
- "24X500ML" in description → unit_type="count", units_per_case=24, box_weight_kg=null
- "16X250G" or "10X500G" → unit_type="count", units_per_case=16 (or 10)
- "10X2KG" or "15X1KG" → unit_type="count", units_per_case=10 (or 15)
- "X15'S" or "X25'S" or "X14" in Brand → unit_type="count", units_per_case=15 (or 25/14)
- "12KG" or "25KG" alone in description → unit_type="weight", box_weight_kg=12 (or 25), units_per_case=null
- "8" or "18" as the only number at end of description (PINEAPPLE . COSTA RICA 8) → unit_type="count", units_per_case=8
- Pattern "NUMBER WEIGHTKG" where both a count and a weight appear (e.g. "40 15KG", "70 10KG", "35 15KG"):
  - CITRUS fruit (orange, satsuma, mandarin, tangerine, grapefruit, lemon, lime, clementine): NUMBER is the count per box → unit_type="count", units_per_case=NUMBER, box_weight_kg=null
  - STONE FRUIT or BERRY (cherry, plum, nectarine, peach, apricot, strawberry, grape): NUMBER is a calibre/size grade → unit_type="weight", box_weight_kg=WEIGHT, units_per_case=null
  - All other whole fruit: treat NUMBER as count → unit_type="count", units_per_case=NUMBER
- Standalone size codes with no weight (e.g. "CHERRY SPAIN 28" where 28 is calibre and there is no KG figure) → unit_type="weight", box_weight_kg=null, units_per_case=null
- "18.2KG" → unit_type="weight", box_weight_kg=18.2
- If you cannot determine box spec, set unit_type="count", units_per_case=1, box_weight_kg=null`

// How many times to ask the model before giving up. The LLM occasionally
// returns a truncated / non-JSON response (a transient provider hiccup, e.g.
// the J.R. Holland ticket 2745255 on 15 Jun that got cut off mid-field). A
// couple of retries clears almost all of these.
//
// IMPORTANT: retrying here is SAFE against duplicate invoices because this
// function ONLY parses — it never writes to the database. The caller inserts
// the invoice once, after a successful parse returns. Retries are also strictly
// BOUNDED by PARSE_MAX_ATTEMPTS, so a permanently-bad PDF fails fast (it does
// not loop forever); the caller's catch block then skips that one attachment.
const PARSE_MAX_ATTEMPTS = 3

/**
 * Parse a market invoice PDF or photo using OpenRouter vision.
 * base64Content: the file as a base64-encoded string.
 * mimeType: the file MIME type (default: application/pdf).
 *
 * Retries up to PARSE_MAX_ATTEMPTS times on a truncated / unparseable model
 * response. Does NOT write to the DB, so retries cannot create duplicates.
 */
export async function parseInvoicePdf(base64Content: string, mimeType = 'application/pdf'): Promise<ParsedInvoice> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= PARSE_MAX_ATTEMPTS; attempt++) {
    try {
      return await parseInvoiceOnce(base64Content, mimeType)
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[invoice-parser] parse attempt ${attempt}/${PARSE_MAX_ATTEMPTS} failed: ${msg}`)
      if (attempt < PARSE_MAX_ATTEMPTS) {
        // brief backoff before re-asking the model
        await new Promise(r => setTimeout(r, 800 * attempt))
      }
    }
  }
  throw lastErr instanceof Error
    ? new Error(`Parse failed after ${PARSE_MAX_ATTEMPTS} attempts: ${lastErr.message}`)
    : new Error(`Parse failed after ${PARSE_MAX_ATTEMPTS} attempts`)
}

/** Single parse attempt — one model call, throws on empty/truncated/unparseable output. */
async function parseInvoiceOnce(base64Content: string, mimeType: string): Promise<ParsedInvoice> {
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
              url: `data:${mimeType};base64,${base64Content}`,
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
  // A 'length' finish means the response was cut off mid-JSON — treat as a
  // retryable failure rather than trying to parse half an object.
  const finishReason = response.choices[0]?.finish_reason
  if (finishReason === 'length') {
    throw new Error(`Model response truncated (finish_reason=length): ${text.slice(0, 300)}`)
  }

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
    invoice_number: string | null
  }

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Model returned unparseable JSON: ${jsonMatch[0].slice(0, 300)}`)
  }

  return {
    supplier_name: parsed.supplier_name ?? 'Unknown',
    invoice_date: parsed.invoice_date ?? new Date().toISOString().slice(0, 10),
    items: (parsed.items ?? []).map(item => {
      let unit_type: 'count' | 'weight' = item.unit_type ?? 'count'
      let units_per_case = item.units_per_case ?? null
      const box_weight_kg = item.box_weight_kg ?? null
      // Deterministic fallback: the model sometimes drops an explicit multipack
      // marker that is plainly in the text (e.g. "8X500G", "X16"). Recover it
      // only when the model left BOTH pack fields blank.
      if (units_per_case == null && box_weight_kg == null) {
        const inferred = inferBoxSpec(item.product_name_raw)
        if (inferred) { unit_type = inferred.unit_type; units_per_case = inferred.units_per_case }
      }
      return {
        product_name_raw: item.product_name_raw,
        brand_raw:        item.brand_raw        ?? '',
        quantity:         item.quantity         ?? 1,
        unit_cost:        item.unit_cost_pence  ?? 0,
        total_cost:       item.total_cost_pence ?? 0,
        unit_type,
        units_per_case,
        box_weight_kg,
      }
    }),
    raw_total: parsed.raw_total_pence ?? null,
    invoice_number: parsed.invoice_number ?? null,
  }
}

/**
 * Deterministic box-spec fallback for unambiguous multipack markers the model
 * occasionally misses. Only handles patterns with no calibre/citrus ambiguity —
 * standalone weights ("12KG") and bare trailing numbers ("BRAZIL 9") are left to
 * the model, since those need fruit-type knowledge to read correctly.
 */
export function inferBoxSpec(raw: string): { unit_type: 'count'; units_per_case: number } | null {
  const s = (raw ?? '').toUpperCase()
  // 1. Multipack "NxWEIGHT": leading N before X then a weight unit → N units/box
  //    e.g. 8X500G, 10X2KG, 24X500ML, 16X250G, 11X500G
  let m = s.match(/(\d{1,3})\s*X\s*\d+(?:\.\d+)?\s*(?:KG|G|ML|L)\b/)
  if (m) return { unit_type: 'count', units_per_case: parseInt(m[1], 10) }
  // 2. X-prefixed case count "X16" / "X12" (1–2 digits; (?!\d) skips gram weights
  //    like X250). Skipped when the line also carries a standalone box weight
  //    (e.g. "12KG … X70"), where the weight is the better cost basis.
  if (!/\d+(?:\.\d+)?\s*KG\b/.test(s)) {
    m = s.match(/X\s*(\d{1,2})(?!\d)/)
    if (m) return { unit_type: 'count', units_per_case: parseInt(m[1], 10) }
  }
  return null
}

/** Normalise a supplier name for consistent mapping keys */
export function normaliseSupplierName(name: string): string {
  return name.toLowerCase().replace(/\./g, '').trim().replace(/\s+/g, ' ')
}

/**
 * Normalise a raw invoice description for matching — case / punctuation /
 * whitespace insensitive, so the same product under different spellings
 * ("ONION . SPAIN 1 20KG ." vs "ONION. SPAIN 1 20KG.") collapses to one mapping
 * key and stops generating punctuation-only re-asks. Decimals are preserved
 * (2.27KG stays 2.27KG — only separator dots/commas are dropped). Result is the
 * value stored in supplier_product_mappings.normalised_description and the key
 * every lookup matches on. MUST stay identical to the backfill script.
 */
export function normaliseDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/(?<!\d)[.,](?!\d)/g, ' ')  // drop separator . and , but keep 2.27
    .replace(/\s+/g, ' ')
    .trim()
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
  const norm = normaliseDescription(rawDescription)
  const { data } = await supabase
    .from('supplier_product_mappings')
    .select('product_id, match_count, unit_type, units_per_case, box_weight_kg')
    .eq('supplier_name', normaliseSupplierName(supplierName))
    .eq('normalised_description', norm)
    .eq('status', 'confirmed')
    .not('product_id', 'is', null)
    .single()

  if (!data?.product_id) return null

  // Bump usage counter (fire-and-forget)
  supabase
    .from('supplier_product_mappings')
    .update({ match_count: data.match_count + 1 })
    .eq('supplier_name', normaliseSupplierName(supplierName))
    .eq('normalised_description', norm)
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
        normalised_description: normaliseDescription(rawDescription),
        product_id:      productId,
        confirmed_by:    confirmedBy,
        status:          confirmedBy ? 'confirmed' : 'confirmed',
        ...(boxSpec?.unit_type     !== undefined && { unit_type:      boxSpec.unit_type }),
        ...(boxSpec?.units_per_case !== undefined && { units_per_case: boxSpec.units_per_case }),
        ...(boxSpec?.box_weight_kg  !== undefined && { box_weight_kg:  boxSpec.box_weight_kg }),
        ...(boxSpec?.last_price_p   !== undefined && { last_price_p:   boxSpec.last_price_p }),
      },
      {
        onConflict: 'supplier_name,normalised_description',
        ignoreDuplicates: false,
      }
    )
}

/**
 * Fuzzy-match a raw product name against the catalogue.
 * Returns the best matching product_id or null.
 */
// Vendor abbreviations that don't match catalogue names directly
const PRODUCE_SYNONYMS: [RegExp, string][] = [
  [/\bmelon water\b/g, 'watermelon'],
  [/\bmel water\b/g,   'watermelon'],
  [/\bmel wat\b/g,     'watermelon'],
]

// Descriptor words that appear in catalogue names but not invoice lines
const FILLER_TOKENS = new Set(['loose', 'prepack', 'punnet', 'bag', 'pack', 'box'])

export function fuzzyMatchProduct(
  rawName: string,
  catalogue: Array<{ id: string; name: string }>
): string | null {
  const normalise = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

  let needle = normalise(rawName)
  for (const [pattern, replacement] of PRODUCE_SYNONYMS) {
    needle = needle.replace(pattern, replacement)
  }

  let bestId: string | null = null
  let bestScore = 0

  for (const product of catalogue) {
    const haystack = normalise(product.name)
    // Score by how many catalogue name tokens appear in the invoice name.
    // Exclude filler words (loose, punnet, etc.) — suppliers never print them.
    const catalogueTokens = haystack.split(/\s+/).filter(t => t.length > 1)
    const significantTokens = catalogueTokens.filter(t => !FILLER_TOKENS.has(t))
    const tokensToMatch = significantTokens.length > 0 ? significantTokens : catalogueTokens
    const matched = tokensToMatch.filter(t => needle.includes(t))
    const score = matched.length / tokensToMatch.length

    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestId = product.id
    }
  }

  return bestId
}
