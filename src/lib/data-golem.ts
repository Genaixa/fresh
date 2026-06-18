import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelegram } from './telegram'
import { CONFIG } from '@/app/market/config'
import { runMappingSuggester } from './mapping-golem'

export interface GolemFinding {
  alert_type: string
  severity:   'critical' | 'warning' | 'info'
  product_id?:   string
  product_name?: string
  message:  string
  action?:  string
  source:   'data_golem' | 'daily_sweep'
}

// ─── Jewish holiday calendar (upcoming within 30 days) ──────────────────────
// product names that spike before each holiday
const HOLIDAY_PRODUCTS: Record<string, string[]> = {
  'Rosh Hashanah':  ['Pomegranate', 'Apple Royal Gala', 'Apple Braeburn', 'Apple Pink Lady', 'Honey Date', 'Medjool Date'],
  'Sukkot':         ['Pomegranate', 'Apple Royal Gala', 'Lemon', 'Etrog'],
  'Tu B\'Shvat':    ['Pomegranate', 'Dates', 'Fig', 'Medjool Date'],
  'Purim':          ['Strawberry'],
  'Pesach':         ['Horseradish', 'Lettuce Cos', 'Lettuce Iceberg', 'Lettuce Little Gem'],
  'Shavuot':        ['Strawberry', 'Cherry'],
}

// Approximate upcoming holiday dates (extend as needed)
const UPCOMING_HOLIDAYS = [
  { name: 'Rosh Hashanah', date: new Date('2026-09-19') },
  { name: 'Sukkot',        date: new Date('2026-10-14') },
  { name: 'Purim',         date: new Date('2027-03-13') },
  { name: 'Pesach',        date: new Date('2027-04-02') },
  { name: 'Shavuot',       date: new Date('2027-05-22') },
  { name: 'Tu B\'Shvat',   date: new Date('2027-02-01') },
]

const MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
]

// ─── Check 1: Unmatched invoice items in last 7 days ────────────────────────
async function checkUnmatchedItems(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const { data } = await supabase
    .from('purchase_invoice_items')
    .select('product_name_raw, invoice_id, purchase_invoices(supplier_name, invoice_date)')
    .eq('is_matched', false)
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  if (!data?.length) return []

  // Group by raw description
  const grouped = new Map<string, { supplier: string; date: string }>()
  for (const item of data) {
    const inv = (item.purchase_invoices as unknown) as { supplier_name: string; invoice_date: string } | null
    if (!grouped.has(item.product_name_raw)) {
      grouped.set(item.product_name_raw, {
        supplier: inv?.supplier_name ?? 'unknown',
        date:     inv?.invoice_date  ?? '',
      })
    }
  }

  return [...grouped.entries()].map(([raw, { supplier, date }]) => ({
    alert_type:  'unmatched_item',
    severity:    'warning' as const,
    product_name: raw,
    message:  `"${raw}" (${supplier}, ${date}) couldn't be matched to any product — needs mapping.`,
    action:   'Go to invoice review page and map this item to the correct product.',
    source,
  }))
}

// ─── Check 2: Stale costs — regularly-bought products not seen recently ──────
async function checkStaleCosts(
  supabase: SupabaseClient,
  supplierName: string | null,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  // Products bought ≥3 times ever but last invoice was >14 days ago
  const { data } = await supabase.rpc('golem_stale_costs', {
    supplier_filter: supplierName,
    stale_days:      14,
    min_appearances: 3,
  })

  if (!data?.length) return []

  return (data as { id: string; name: string; last_invoice_date: string; days_since: number }[])
    .filter(r => r.days_since > 14)
    .map(r => ({
      alert_type:  'stale_cost',
      severity:    r.days_since > 30 ? 'warning' as const : 'info' as const,
      product_id:   r.id,
      product_name: r.name,
      message:  `${r.name} hasn't appeared on any invoice for ${r.days_since} days — cost may be outdated.`,
      action:   'Check if still being bought, and from which supplier.',
      source,
    }))
}

// ─── Check 3: Cost drift — today's price far from 4-week average ─────────────
async function checkCostDrift(
  supabase: SupabaseClient,
  invoiceId: string,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, product_name_raw, unit_cost, products(name, purchase_cost)')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items?.length) return []

  const findings: GolemFinding[] = []
  for (const item of items) {
    const product = (item.products as unknown) as { name: string; purchase_cost: number } | null
    if (!product || !product.purchase_cost || product.purchase_cost < 10) continue

    const drift = (item.unit_cost - product.purchase_cost) / product.purchase_cost
    if (Math.abs(drift) < 0.30) continue  // <30% drift — unremarkable

    const dir      = drift > 0 ? 'up' : 'down'
    const pct      = Math.round(Math.abs(drift) * 100)
    const severity = Math.abs(drift) > 0.50 ? 'critical' as const : 'warning' as const

    findings.push({
      alert_type:  'cost_drift',
      severity,
      product_id:   item.product_id!,
      product_name: product.name,
      message:  `${product.name} is ${pct}% ${dir} on this invoice (£${(item.unit_cost / 100).toFixed(2)} vs stored £${(product.purchase_cost / 100).toFixed(2)}).`,
      action:   drift > 0
        ? 'Check if retail price needs raising.'
        : 'Potential buying opportunity — cost has dropped.',
      source,
    })
  }
  return findings
}

// ─── Check 4: Expire stale price suggestions ─────────────────────────────────
async function expireOldSuggestions(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data } = await supabase
    .from('price_suggestions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('product_id')

  if (!data?.length) return []

  return [{
    alert_type:  'expired_suggestions',
    severity:    'info' as const,
    message:  `${data.length} price suggestion${data.length > 1 ? 's' : ''} expired (no action taken in 14 days). Fresh ones will generate on the next invoice.`,
    source,
  }]
}

// ─── Check 5: Delivery gap — expected suppliers didn't send today ─────────────
async function checkDeliveryGap(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const today = new Date().toISOString().slice(0, 10)
  const dow   = new Date().getDay()  // 0=Sun, 6=Sat

  // Only flag on weekdays (Mon–Sat)
  if (dow === 0) return []

  const EXPECTED = ['Total Produce', 'JR Holland']
  const { data } = await supabase
    .from('purchase_invoices')
    .select('supplier_name')
    .eq('invoice_date', today)

  const arrived = new Set((data ?? []).map(r => r.supplier_name))
  const findings: GolemFinding[] = []

  for (const supplier of EXPECTED) {
    if (!arrived.has(supplier)) {
      findings.push({
        alert_type:  'delivery_gap',
        severity:    'warning' as const,
        message:  `No invoice from ${supplier} today (${today}). Either no delivery or email didn't arrive.`,
        action:   `Check if David bought from ${supplier} today. If so, upload the PDF manually.`,
        source,
      })
    }
  }
  return findings
}

// ─── Check 6: Dual-supplier arbitrage ────────────────────────────────────────
async function checkArbitrage(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const { data } = await supabase
    .from('product_supplier_last_price')
    .select('product_id, supplier_name, last_price_p, last_date')

  if (!data?.length) return []

  // Group by product
  const byProduct = new Map<string, { dole?: number; holland?: number }>()
  for (const row of data) {
    const entry = byProduct.get(row.product_id) ?? {}
    if (row.supplier_name === 'dole wholesale gateshead') entry.dole = row.last_price_p
    if (row.supplier_name === 'jr holland')               entry.holland = row.last_price_p
    byProduct.set(row.product_id, entry)
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .in('id', [...byProduct.keys()])

  const nameMap = new Map((products ?? []).map(p => [p.id, p.name]))
  const findings: GolemFinding[] = []

  for (const [pid, prices] of byProduct) {
    if (!prices.dole || !prices.holland) continue
    const diff = Math.abs(prices.dole - prices.holland) / Math.min(prices.dole, prices.holland)
    if (diff < 0.20) continue  // <20% difference — not worth flagging

    const cheaper   = prices.dole < prices.holland ? 'Dole' : 'Holland'
    const expensive = prices.dole < prices.holland ? 'Holland' : 'Dole'
    const pct       = Math.round(diff * 100)
    const name      = nameMap.get(pid) ?? pid

    findings.push({
      alert_type:  'arbitrage',
      severity:    'info' as const,
      product_id:   pid,
      product_name: name,
      message:  `${name}: ${cheaper} is ${pct}% cheaper than ${expensive} (£${(Math.min(prices.dole, prices.holland) / 100).toFixed(2)} vs £${(Math.max(prices.dole, prices.holland) / 100).toFixed(2)}/box).`,
      action:   `Consider buying from ${cheaper} next time.`,
      source,
    })
  }

  return findings.sort((a, b) => (b.message > a.message ? 1 : -1)).slice(0, 5)
}

// ─── Check 7: Upcoming holiday prep ──────────────────────────────────────────
async function checkHolidayPrep(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const now       = Date.now()
  const findings: GolemFinding[] = []

  for (const holiday of UPCOMING_HOLIDAYS) {
    const daysUntil = Math.round((holiday.date.getTime() - now) / 86400000)
    if (daysUntil < 0 || daysUntil > 30) continue

    const products = HOLIDAY_PRODUCTS[holiday.name] ?? []
    if (!products.length) continue

    findings.push({
      alert_type:  'holiday_prep',
      severity:    daysUntil <= 7 ? 'warning' as const : 'info' as const,
      message:  `${holiday.name} is in ${daysUntil} days — historically high demand for: ${products.join(', ')}.`,
      action:   'Consider stocking extra at the market this week.',
      source,
    })
  }
  return findings
}

// ─── Check 8: Pending wholesale orders (morning briefing) ────────────────────
// Returns a formatted HTML string for Telegram — not a GolemFinding list.
async function buildOrdersBriefing(supabase: SupabaseClient): Promise<string | null> {
  const today   = new Date().toISOString().slice(0, 10)
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, delivery_date, customer:wholesale_customers(name), items:wholesale_order_items(quantity, product:products(id, name))')
    .in('status', ['draft', 'confirmed'])
    .or(`delivery_date.lte.${in7days},delivery_date.is.null`)
    .order('delivery_date', { ascending: true, nullsFirst: false })

  if (!orders?.length) return null

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const lines: string[] = ['📋 <b>Pending wholesale orders:</b>']
  const notOnMarketPage: string[] = []

  for (const order of orders) {
    const customer = (order.customer as any)?.name ?? 'Unknown'
    const items    = (order.items as any[]) ?? []
    const dueLabel = !order.delivery_date  ? 'no date set'
      : order.delivery_date === today      ? '⚡ TODAY'
      : order.delivery_date === tomorrow   ? 'tomorrow'
      : order.delivery_date

    const itemList = items.map((i: any) => {
      const name    = (i.product as any)?.name ?? 'unknown'
      const qty     = Number(i.quantity)
      const visible = CONFIG[name] !== undefined
      if (!visible && name !== 'unknown') notOnMarketPage.push(name)
      return `${qty}× ${name}${visible ? '' : ' ⚠️'}`
    }).join(', ')

    lines.push(`  • <b>${customer}</b> (${dueLabel}): ${itemList}`)
  }

  if (notOnMarketPage.length > 0) {
    const unique = [...new Set(notOnMarketPage)]
    lines.push(`\n⚠️ Not visible on market page: ${unique.join(', ')} — add to config or buy manually`)
  }

  return lines.join('\n')
}

// ─── Check 9: Order fulfillment after market ──────────────────────────────────
// Compares today's market_session_items (what David actually bought)
// against wholesale orders due today or tomorrow.
async function checkOrderFulfillment(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<{ findings: GolemFinding[]; telegramLines: string[] }> {
  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  // What David bought today at market
  const { data: sessions } = await supabase
    .from('market_sessions')
    .select('id')
    .eq('session_date', today)

  const boughtMap = new Map<string, number>()
  if (sessions?.length) {
    const { data: sessionItems } = await supabase
      .from('market_session_items')
      .select('product_id, qty_boxes')
      .in('session_id', sessions.map(s => s.id))
    for (const it of sessionItems ?? []) {
      boughtMap.set(it.product_id, (boughtMap.get(it.product_id) ?? 0) + it.qty_boxes)
    }
  }

  // Orders due today or tomorrow
  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, delivery_date, customer:wholesale_customers(name), items:wholesale_order_items(quantity, product_id, product:products(id, name, case_size))')
    .in('status', ['draft', 'confirmed'])
    .or(`delivery_date.eq.${today},delivery_date.eq.${tomorrow}`)

  if (!orders?.length) return { findings: [], telegramLines: [] }

  // Aggregate required boxes per product across all orders
  interface Need { boxes: number; customers: string[]; name: string }
  const requiredMap = new Map<string, Need>()
  for (const order of orders) {
    const customerName = (order.customer as any)?.name ?? 'Unknown'
    for (const item of (order.items as any[]) ?? []) {
      const pid      = item.product_id as string
      const name     = (item.product as any)?.name ?? pid
      const caseSize = (item.product as any)?.case_size ?? 1
      const needed   = Math.ceil(Number(item.quantity) / caseSize)
      const existing: Need = requiredMap.get(pid) ?? { boxes: 0, customers: [] as string[], name }
      existing.boxes += needed
      if (!existing.customers.includes(customerName)) existing.customers.push(customerName)
      requiredMap.set(pid, existing)
    }
  }

  const findings: GolemFinding[] = []
  const telegramLines: string[] = []

  for (const [pid, { boxes: needed, customers, name }] of requiredMap) {
    const bought = boughtMap.get(pid) ?? 0
    if (bought >= needed) continue
    const shortfall = needed - bought
    const detail    = bought > 0
      ? `need ${needed} box${needed > 1 ? 'es' : ''}, bought ${bought} (${shortfall} short)`
      : `need ${needed} box${needed > 1 ? 'es' : ''}, not bought`
    const msg = `${name}: ${detail} — for ${customers.join(', ')}`
    findings.push({
      alert_type:   'order_shortfall',
      severity:     'critical' as const,
      product_id:    pid,
      product_name:  name,
      message:       msg,
      action:       'Call supplier or check storeroom stock.',
      source,
    })
    telegramLines.push(`  • ${msg}`)
  }

  return { findings, telegramLines }
}

// ─── Check 10: Invoice reconciliation — lines must sum to printed total ───────
// Catches the failure that silently dropped JR Holland ticket 2745255 on
// 15 Jun: a parser truncation that lost a line (or a whole invoice's worth).
// Works at the DB level so it catches the EFFECT regardless of cause.
async function checkReconciliation(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, supplier_name, total_amount')
    .eq('invoice_date', today)
    .neq('status', 'error')

  if (!invoices?.length) return []

  const findings: GolemFinding[] = []
  for (const inv of invoices) {
    if (inv.total_amount == null) continue
    const { data: items } = await supabase
      .from('purchase_invoice_items')
      .select('total_cost')
      .eq('invoice_id', inv.id)

    const lineSum = (items ?? []).reduce((s, i) => s + (i.total_cost ?? 0), 0)
    const gap = inv.total_amount - lineSum
    if (Math.abs(gap) <= 1) continue  // matches (allow 1p rounding)

    // total_amount is inc-VAT but lines are ex-VAT, and there's no per-line VAT
    // flag. A positive gap up to 20% of goods is just VAT on standard-rated lines
    // (water, drinks, packaging) — don't cry wolf (e.g. Dole 11244548: £3.60 on
    // the bottled water). A genuinely dropped line shows up as a much bigger
    // positive gap; a double-counted line shows up as a negative gap. Both still fire.
    if (gap > 0 && gap <= Math.round(lineSum * 0.20)) continue

    const ref = inv.invoice_number ?? '(no number)'
    findings.push({
      alert_type:  'reconcile_gap',
      severity:    'critical' as const,
      message:  `${inv.supplier_name} ${ref}: lines sum to £${(lineSum / 100).toFixed(2)} but invoice total is £${(inv.total_amount / 100).toFixed(2)} — £${(Math.abs(gap) / 100).toFixed(2)} ${gap > 0 ? 'MISSING (a line was dropped or misread)' : 'extra (a line was double-counted)'}.`,
      action:   'Open the invoice and add/fix the line so it reconciles.',
      source,
    })
  }
  return findings
}

// ─── Check 11: Suspicious ingest — small-hours / pre-market arrivals ──────────
// Flags notes ingested before the market opened (e.g. the 03:05 BST Thomas Baty
// DN258597/DN258305 re-sends deleted on 15 Jun) — almost always a re-sent or
// mis-dated old note rather than a real same-day delivery.
async function checkSuspiciousIngest(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('invoice_number, supplier_name, created_at')
    .eq('invoice_date', today)
    .neq('status', 'error')

  if (!invoices?.length) return []

  const findings: GolemFinding[] = []
  for (const inv of invoices) {
    const ts = new Date(inv.created_at)
    if (ts.getUTCHours() >= 5) continue  // 00:00–05:00 UTC = before the market
    const hhmm = ts.toISOString().slice(11, 16)
    findings.push({
      alert_type:  'suspicious_ingest',
      severity:    'warning' as const,
      message:  `${inv.supplier_name} ${inv.invoice_number ?? ''} was ingested at ${hhmm} UTC — before the market opened. Likely a re-sent/mis-dated old note (cf. the 3am Baty DN258597/DN258305 removed 15 Jun), not a real delivery.`,
      action:   'Check against the paper ticket; delete if it is a re-send polluting cost data.',
      source,
    })
  }
  return findings
}

// ─── Check 12: Price-suggestion plausibility sentinel ────────────────────────
// Guards the failure class behind the 18 Jun "£14 lychee" incident: a per-case or
// per-kg cost read as per-unit contaminates product_weighted_costs, and the ×2
// markup explodes it into a nonsense suggestion that can slip past the withhold
// ceiling (esp. for cheap items where the category-median anchor is loose).
//
// Three signals, cheapest/strongest first:
//   (a) cost-above-shelf — weighted cost ≥ current retail: the per-case signature.
//   (b) implausible pending suggestion — suggested ≥ 2.5× the live shelf price.
//   (c) zero-cost active seller — purchase_cost 0 ⇒ "infinite margin" suggestions.
async function checkSuggestionPlausibility(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`
  const findings: GolemFinding[] = []

  // (a) Weighted cost at/above shelf price — almost always a per-case/per-kg cost
  //     read as per-unit. retail_price ≥ 20p so we only judge trustworthy anchors.
  const { data: costs } = await supabase
    .from('product_weighted_costs')
    .select('product_id, weighted_unit_cost_pence, products!inner(name, retail_price, purchase_cost, case_size, is_active)')

  for (const row of (costs ?? []) as any[]) {
    const p = row.products
    if (!p?.is_active) continue
    const wcost  = row.weighted_unit_cost_pence as number
    const retail = p.retail_price as number
    if (!wcost || retail < 20) continue

    if (wcost >= retail) {
      const caseSize = p.case_size ?? 1
      const hint = caseSize > 1 ? ` (÷ case of ${caseSize} ≈ ${gbp(Math.round(wcost / caseSize))}/unit)` : ''
      findings.push({
        alert_type:  'implausible_cost',
        severity:    'warning',
        product_id:   row.product_id,
        product_name: p.name,
        message:  `${p.name}: weighted cost ${gbp(wcost)} is at/above shelf ${gbp(retail)}${hint} — almost certainly a per-case/per-kg price read as per-unit. Suggestions off this cost will be wrong.`,
        action:   'Check units_per_case / unit_type on the recent invoice lines (cf. migration 0090).',
        source,
      })
    }
  }

  // (b) Implausible pending suggestion — a big jump off a trustworthy shelf price.
  const { data: sugg } = await supabase
    .from('price_suggestions')
    .select('current_retail_price, suggested_retail_price, products!inner(name)')
    .eq('status', 'pending')

  for (const s of (sugg ?? []) as any[]) {
    const cur = s.current_retail_price as number
    const sug = s.suggested_retail_price as number
    if (cur < 20 || sug < cur * 2.5) continue
    findings.push({
      alert_type:  'implausible_suggestion',
      severity:    'warning',
      product_name: s.products?.name,
      message:  `${s.products?.name}: suggested ${gbp(sug)} is ${(sug / cur).toFixed(1)}× the shelf price ${gbp(cur)} — looks wrong, do not "Approve All".`,
      action:   'Open the suggestion; if the cost behind it is a box price, fix units_per_case.',
      source,
    })
  }

  // (c) Zero-cost active sellers that are ACTUALLY being bought (have a weighted-cost
  //     row) — these produce "infinite margin" suggestions. Bought-in finished goods
  //     (milk, eggs, nuts) legitimately have no produce cost, so the inner join to
  //     product_weighted_costs keeps this to genuine pipeline products only.
  const { data: zero } = await supabase
    .from('product_weighted_costs')
    .select('product_id, products!inner(name, retail_price, purchase_cost, is_active)')

  for (const row of (zero ?? []) as any[]) {
    const z = row.products
    if (!z?.is_active || !z.retail_price || z.retail_price <= 0) continue
    if (z.purchase_cost != null && z.purchase_cost > 0) continue
    findings.push({
      alert_type:  'zero_cost',
      severity:    'warning',
      product_id:   row.product_id,
      product_name: z.name,
      message:  `${z.name}: bought through the pipeline and on sale at ${gbp(z.retail_price)} but purchase_cost is 0 — margin/suggestions can't be trusted.`,
      action:   'Set the correct per-unit cost, or confirm the supplier mapping is right.',
      source,
    })
  }

  return findings
}

// ─── LLM briefing synthesis ───────────────────────────────────────────────────
async function generateBriefing(findings: GolemFinding[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !findings.length) return null

  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })

  const critical = findings.filter(f => f.severity === 'critical')
  const warnings = findings.filter(f => f.severity === 'warning')
  const infos    = findings.filter(f => f.severity === 'info')

  const summary = [
    critical.length ? `CRITICAL (${critical.length}): ${critical.map(f => f.message).join(' | ')}` : '',
    warnings.length ? `Warnings (${warnings.length}): ${warnings.map(f => f.message).slice(0, 3).join(' | ')}` : '',
    infos.length    ? `Info (${infos.length}): ${infos.map(f => f.message).slice(0, 2).join(' | ')}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are the Data Golem for Fresh & Fruity, a Newcastle greengrocer. Owner is David (ADHD — keep it short, direct, no waffle).

Here are today's data findings:
${summary}

Write a briefing in 2-3 sentences max. Start with the most critical item. Use £ amounts. Plain English. No bullet points.`

  const result = await Promise.race([
    Promise.any(
      MODELS.map(model =>
        client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 120,
          stream: false,
        }).then(r => {
          const text = r.choices[0]?.message?.content?.trim()
          if (!text) throw new Error('empty')
          return text
        })
      )
    ).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
  ])

  return result
}

// ─── Store findings to DB ─────────────────────────────────────────────────────
async function storeFindings(
  supabase: SupabaseClient,
  findings: GolemFinding[],
): Promise<void> {
  if (!findings.length) return
  // Avoid duplicates: skip alerts for same product + type already raised today
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('golem_alerts')
    .select('alert_type, product_name')
    .gte('created_at', today)
    .eq('resolved', false)

  const existingKeys = new Set(
    (existing ?? []).map(e => `${e.alert_type}::${e.product_name ?? ''}`)
  )

  const toInsert = findings.filter(f => {
    const key = `${f.alert_type}::${f.product_name ?? ''}`
    return !existingKeys.has(key)
  })

  if (toInsert.length) {
    await supabase.from('golem_alerts').insert(toInsert)
  }
}

// ─── Check 13: Mapping suggester — auto-map obvious lines, queue the rest ─────
// Runs the mapping golem and turns its result into findings. Must run BEFORE the
// unmatched-item check so freshly auto-mapped lines aren't also nagged.
async function runMappingGolem(
  supabase: SupabaseClient,
  source: GolemFinding['source'],
): Promise<GolemFinding[]> {
  const { autoApplied, suggested, decisions } = await runMappingSuggester(supabase)
  const findings: GolemFinding[] = []
  const list = (a: 'auto' | 'suggest') =>
    decisions.filter(d => d.action === a).map(d => `${d.raw.trim()} → ${d.productName}`)

  if (autoApplied > 0) {
    const names = list('auto')
    findings.push({
      alert_type: 'mapping_auto',
      severity:   'info',
      message:  `Auto-mapped ${autoApplied} supplier line${autoApplied > 1 ? 's' : ''} from confirmed mappings: ${names.slice(0, 6).join('; ')}${names.length > 6 ? '…' : ''}.`,
      action:   'Costs are re-checked by the plausibility sentinel — no action needed unless flagged.',
      source,
    })
  }
  if (suggested > 0) {
    const names = list('suggest')
    findings.push({
      alert_type: 'mapping_review',
      severity:   'warning',
      message:  `${suggested} supplier line${suggested > 1 ? 's' : ''} have a suggested mapping awaiting your OK: ${names.slice(0, 6).join('; ')}${names.length > 6 ? '…' : ''}.`,
      action:   'Confirm or fix on /invoice-mapping — product + box size are pre-filled, one tap each.',
      source,
    })
  }
  return findings
}

// ─── Main entry points ────────────────────────────────────────────────────────

/** Run after a specific invoice is confirmed. */
export async function runPostInvoiceGolem(
  supabase: SupabaseClient,
  invoiceId: string,
  supplierName: string,
): Promise<void> {
  const findings: GolemFinding[] = []

  // Map first so freshly auto-mapped lines aren't re-nagged below.
  findings.push(...await runMappingGolem(supabase, 'data_golem'))

  const [unmatched, stale, drift, expired, fulfillment, plausibility] = await Promise.all([
    checkUnmatchedItems(supabase, 'data_golem'),
    checkStaleCosts(supabase, supplierName, 'data_golem'),
    checkCostDrift(supabase, invoiceId, 'data_golem'),
    expireOldSuggestions(supabase, 'data_golem'),
    checkOrderFulfillment(supabase, 'data_golem'),
    checkSuggestionPlausibility(supabase, 'data_golem'),
  ])

  findings.push(...unmatched, ...stale, ...drift, ...expired, ...fulfillment.findings, ...plausibility)
  await storeFindings(supabase, findings)

  if (fulfillment.telegramLines.length > 0) {
    await sendTelegram(
      `🔴 <b>Order shortfall — market done but stock is short:</b>\n${fulfillment.telegramLines.join('\n')}\n\nCheck storeroom or call supplier.`
    )
  }

  console.log(`[DataGolem] post-invoice sweep: ${findings.length} findings for invoice ${invoiceId}`)
}

/** Full daily sweep — run once a day (e.g., 10am). */
export async function runDailySweep(supabase: SupabaseClient): Promise<string | null> {
  const findings: GolemFinding[] = []

  // Map first so freshly auto-mapped lines aren't re-nagged below.
  findings.push(...await runMappingGolem(supabase, 'daily_sweep'))

  const [unmatched, stale, expired, gaps, arbitrage, holidays, reconcile, suspicious, plausibility, ordersBriefing] = await Promise.all([
    checkUnmatchedItems(supabase, 'daily_sweep'),
    checkStaleCosts(supabase, null, 'daily_sweep'),
    expireOldSuggestions(supabase, 'daily_sweep'),
    checkDeliveryGap(supabase, 'daily_sweep'),
    checkArbitrage(supabase, 'daily_sweep'),
    checkHolidayPrep(supabase, 'daily_sweep'),
    checkReconciliation(supabase, 'daily_sweep'),
    checkSuspiciousIngest(supabase, 'daily_sweep'),
    checkSuggestionPlausibility(supabase, 'daily_sweep'),
    buildOrdersBriefing(supabase),
  ])

  findings.push(...unmatched, ...stale, ...expired, ...gaps, ...arbitrage, ...holidays, ...reconcile, ...suspicious, ...plausibility)
  await storeFindings(supabase, findings)

  const briefing = await generateBriefing(findings.filter(f => f.severity !== 'info'))

  if (briefing) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('golem_briefings').upsert({
      briefing_date: today,
      content:       briefing,
      finding_count: findings.length,
    }, { onConflict: 'briefing_date' })
  }

  console.log(`[DataGolem] daily sweep: ${findings.length} findings, briefing: ${briefing ? 'yes' : 'none'}`)

  if (briefing || findings.length > 0 || ordersBriefing) {
    const critical = findings.filter(f => f.severity === 'critical').length
    const warnings = findings.filter(f => f.severity === 'warning').length
    const header   = critical > 0
      ? `🔴 <b>Data Golem — ${critical} critical issue${critical > 1 ? 's' : ''}</b>`
      : warnings > 0
        ? `🟡 <b>Data Golem — ${warnings} warning${warnings > 1 ? 's' : ''}</b>`
        : `🟢 <b>Data Golem — all clear</b>`
    const dataSection = [header, briefing ?? (findings.length > 0 ? `${findings.length} findings logged.` : null)].filter(Boolean).join('\n')
    const parts = [ordersBriefing, dataSection].filter(Boolean)
    await sendTelegram(parts.join('\n\n'))
  }

  return briefing
}
