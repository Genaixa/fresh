import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deterministic data-hygiene net for purchase invoices and supplier mappings.
 *
 * Sibling of pricing-invariants.ts. Where that guards the price-suggestion
 * subsystem, this guards the *inputs* — the recorded delivery notes and the
 * cached supplier→product mappings that feed cost. It codifies the three
 * corruption classes found by hand on 23 Jun 2026:
 *
 *   1. MISDATED   — a current-sequence ticket number wearing an old date
 *                   (parser read "23/06/26" as 2023-06-26, not 2026-06-23).
 *   2. STALE_CACHE — a mapping's cached last_price_p wildly out of step with the
 *                   latest real invoice line for the same description (x10 typos).
 *   3. BAD_ARITH  — an invoice line where quantity × unit_cost ≠ total_cost.
 *
 * No intelligence required: these are arithmetic / ordering assertions, not
 * judgment calls. Read-only — never mutates. Returns findings for the caller to
 * alert on. Same "no news = good" philosophy as the pricing invariant check.
 */

export interface HygieneFinding {
  check:  'MISDATED' | 'STALE_CACHE' | 'BAD_ARITH' | 'HEADER_MISMATCH'
  ref:    string   // supplier / ticket / description the issue attaches to
  detail: string
}

const DAY = 24 * 60 * 60 * 1000

/** Trailing/embedded digits of a ticket ref, e.g. "DN259226" → 259226. NaN if none. */
function numericRef(s: string | null): number {
  if (!s) return NaN
  const digits = s.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : NaN
}

export async function checkInvoiceHygiene(supabase: SupabaseClient): Promise<HygieneFinding[]> {
  const findings: HygieneFinding[] = []
  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`

  const today      = new Date()
  const cutoff60   = new Date(today.getTime() - 60  * DAY).toISOString().slice(0, 10)
  const cutoff180  = new Date(today.getTime() - 180 * DAY).toISOString().slice(0, 10)

  // ── Pull the data once ──────────────────────────────────────────────────────
  const { data: invoices, error: invErr } = await supabase
    .from('purchase_invoices')
    .select('supplier_name, invoice_date, invoice_number')
    .not('invoice_number', 'is', null)
    .limit(20000)
  if (invErr) throw new Error(`hygiene: invoice query failed: ${invErr.message}`)

  const { data: items, error: itemErr } = await supabase
    .from('purchase_invoice_items')
    .select('product_name_raw, quantity, unit_cost, total_cost, purchase_invoices!inner(invoice_date, supplier_name, invoice_number)')
    .gte('purchase_invoices.invoice_date', cutoff180)
    .limit(50000)
  if (itemErr) throw new Error(`hygiene: item query failed: ${itemErr.message}`)

  const { data: mappings, error: mapErr } = await supabase
    .from('supplier_product_mappings')
    .select('raw_description, last_price_p')
    .gt('last_price_p', 0)
    .limit(20000)
  if (mapErr) throw new Error(`hygiene: mapping query failed: ${mapErr.message}`)

  type ItemRow = {
    product_name_raw: string
    quantity: number
    unit_cost: number
    total_cost: number
    purchase_invoices: { invoice_date: string; supplier_name: string; invoice_number: string | null }
  }
  const itemRows = (items ?? []) as unknown as ItemRow[]

  // ── Check 1: MISDATED ───────────────────────────────────────────────────────
  // Per supplier, the smallest ticket number seen in the last 60 days is the
  // current sequence floor. Any invoice OLDER than 60 days whose number sits at or
  // above that floor is chronologically impossible — its date was mis-parsed.
  const bySupplier = new Map<string, { recentMin: number; old: { num: number; date: string; ref: string }[] }>()
  for (const inv of (invoices ?? []) as { supplier_name: string; invoice_date: string; invoice_number: string | null }[]) {
    const num = numericRef(inv.invoice_number)
    if (Number.isNaN(num)) continue
    const entry = bySupplier.get(inv.supplier_name) ?? { recentMin: Infinity, old: [] }
    if (inv.invoice_date >= cutoff60) {
      entry.recentMin = Math.min(entry.recentMin, num)
    } else {
      entry.old.push({ num, date: inv.invoice_date, ref: inv.invoice_number! })
    }
    bySupplier.set(inv.supplier_name, entry)
  }
  for (const [supplier, e] of bySupplier) {
    if (!Number.isFinite(e.recentMin)) continue   // no recent baseline → can't judge
    for (const o of e.old) {
      if (o.num >= e.recentMin) {
        findings.push({
          check: 'MISDATED',
          ref: `${supplier} #${o.ref}`,
          detail: `dated ${o.date} but ticket #${o.num} is in the current sequence (≥ ${e.recentMin} seen in last 60d). Date likely mis-parsed.`,
        })
      }
    }
  }

  // ── Check 2: STALE_CACHE ──────────────────────────────────────────────────────
  // Latest real unit_cost per description (within 180d) vs the mapping's cache.
  const latestByDesc = new Map<string, { cost: number; date: string }>()
  for (const it of itemRows) {
    if (it.unit_cost <= 0) continue
    const key = it.product_name_raw.toLowerCase()
    const prev = latestByDesc.get(key)
    if (!prev || it.purchase_invoices.invoice_date > prev.date) {
      latestByDesc.set(key, { cost: it.unit_cost, date: it.purchase_invoices.invoice_date })
    }
  }
  for (const m of (mappings ?? []) as { raw_description: string; last_price_p: number }[]) {
    const latest = latestByDesc.get(m.raw_description.toLowerCase())
    if (!latest || latest.cost === m.last_price_p) continue
    const hi = Math.max(latest.cost, m.last_price_p)
    const lo = Math.min(latest.cost, m.last_price_p)
    if (lo > 0 && hi / lo >= 5) {
      findings.push({
        check: 'STALE_CACHE',
        ref: m.raw_description,
        detail: `cached ${gbp(m.last_price_p)} vs latest invoice ${gbp(latest.cost)} (${latest.date}) — ${(hi / lo).toFixed(0)}× out. Cache likely stale.`,
      })
    }
  }

  // ── Check 3: BAD_ARITH ────────────────────────────────────────────────────────
  // quantity × unit_cost should equal total_cost (allow 2p for fractional-weight rounding).
  for (const it of itemRows) {
    const expected = Math.round(it.quantity * it.unit_cost)
    if (Math.abs(expected - it.total_cost) > 2) {
      const inv = it.purchase_invoices
      findings.push({
        check: 'BAD_ARITH',
        ref: `${inv.supplier_name} #${inv.invoice_number ?? '?'} · ${it.product_name_raw}`,
        detail: `${it.quantity} × ${gbp(it.unit_cost)} = ${gbp(expected)} but total recorded ${gbp(it.total_cost)} (${inv.invoice_date}).`,
      })
    }
  }

  // ── Check 4: HEADER_MISMATCH ──────────────────────────────────────────────────
  // The header total_amount must equal the sum of the invoice's ex-VAT line items.
  // A positive gap usually means a VAT-INCLUSIVE grand total was stored instead of
  // the ex-VAT goods subtotal (Dole note 11254559, 24 Jun 2026: header £487.90 vs
  // items £475.90 = the £12 water VAT). A negative gap means items exceed the
  // header — a dropped/duplicated/mis-parsed line. Ingestion now derives the header
  // from the line items, so this should only fire on legacy rows or manual edits.
  const { data: hdrs, error: hdrErr } = await supabase
    .from('purchase_invoices')
    .select('id, supplier_name, invoice_date, invoice_number, total_amount')
    .not('total_amount', 'is', null)
    .limit(20000)
  if (hdrErr) throw new Error(`hygiene: header query failed: ${hdrErr.message}`)

  const { data: hdrItems, error: hdrItemErr } = await supabase
    .from('purchase_invoice_items')
    .select('invoice_id, total_cost')
    .limit(100000)
  if (hdrItemErr) throw new Error(`hygiene: header-items query failed: ${hdrItemErr.message}`)

  const sumByInvoice = new Map<string, number>()
  for (const it of hdrItems ?? []) {
    sumByInvoice.set(it.invoice_id, (sumByInvoice.get(it.invoice_id) ?? 0) + (it.total_cost ?? 0))
  }
  for (const h of hdrs ?? []) {
    const itemsSum = sumByInvoice.get(h.id)
    if (itemsSum == null) continue   // header with no items captured yet — skip
    if (Math.abs(h.total_amount - itemsSum) > 2) {
      findings.push({
        check: 'HEADER_MISMATCH',
        ref: `${h.supplier_name} #${h.invoice_number ?? '?'}`,
        detail: `header ${gbp(h.total_amount)} ≠ line items ${gbp(itemsSum)} (${h.invoice_date}) — likely a VAT-inclusive total stored instead of ex-VAT, or a dropped line.`,
      })
    }
  }

  return findings
}
