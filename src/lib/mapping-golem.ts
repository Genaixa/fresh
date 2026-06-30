import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliseSupplierName, normaliseDescription } from './invoice-parser'

// ─── Mapping-suggester golem ──────────────────────────────────────────────────
//
// The invoice matcher is exact-string only: a supplier line whose precise
// description isn't already in supplier_product_mappings stays unmatched. This
// golem closes that gap WITHOUT the danger of guessing — it matches each unmatched
// line against the human-CONFIRMED mappings and inherits a confirmed sibling's
// product AND unit basis. It never invents a unit basis (the per-case cost bug),
// and a plausibility gate (cost < shelf) blocks anything that smells contaminated.
//
//   • Strong, unambiguous match  → auto-confirm + match the invoice line(s).
//   • Plausible but not certain   → write a PENDING mapping (product + basis
//                                   pre-filled) for one-tap review on /invoice-mapping.
//   • No confident match          → leave unmatched (visible to-do, as before).
//
// Safety net: the plausibility sentinel (data-golem Check 12) re-checks every cost
// the next morning, so anything that slips through is flagged, not silently shipped.

export interface MappingDecision {
  supplier: string
  raw: string
  itemIds: string[]
  action: 'auto' | 'suggest' | 'skip'
  productId?: string
  productName?: string
  unitType?: 'count' | 'weight'
  unitsPerCase?: number | null
  boxWeightKg?: number | null
  score: number
  reason: string
}

// Origin / format / size noise — stripped when judging PRODUCT identity (but kept
// when picking the closest sibling for the unit BASIS, where pack format matters).
const NOISE = new Set([
  'es','eg','uk','nl','za','pe','sa','rsa','il','ke','cr','cl',
  'spain','spanish','egypt','egyptian','netherlands','dutch','holland','china','chinese',
  'peru','peruvian','chile','chilean','morocco','moroccan','turkey','turkish','brazil',
  'brazilian','italy','italian','cyprus','israel','kenya','france','french','belgium',
  'costa','rica','new','season','best','class','size','large','medium','small','jumbo',
  'mids','prepacked','prepack','packed','pack','boxed','box','bag','bags','loose','net',
])

const toks = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length > 1)

const coreNouns = (s: string): string[] =>
  toks(s).filter(t => /[a-z]/.test(t) && !NOISE.has(t))

/** Token-coverage of `cand`'s core nouns by `target`'s tokens (0..1). */
function coverage(targetCore: Set<string>, candCore: string[]): number {
  if (candCore.length === 0) return 0
  const hit = candCore.filter(t => targetCore.has(t)).length
  return hit / candCore.length
}

/** Full-string token similarity (incl. pack/size tokens) — for picking the basis sibling. */
function fullSim(a: string, b: string): number {
  const A = new Set(toks(a)), B = new Set(toks(b))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / Math.max(A.size, B.size)
}

interface ConfirmedMapping {
  supplier_name: string
  raw_description: string
  product_id: string
  unit_type: 'count' | 'weight' | null
  units_per_case: number | null
  box_weight_kg: number | null
}

/**
 * Core engine. Pass dryRun to compute decisions without writing anything.
 * Returns the decisions plus counts.
 */
export async function runMappingSuggester(
  supabase: SupabaseClient,
  opts: { dryRun?: boolean } = {},
): Promise<{ autoApplied: number; suggested: number; decisions: MappingDecision[] }> {
  const dryRun = opts.dryRun ?? false

  // 1. Unmatched invoice lines (with their supplier + price), last 30 days.
  const { data: rawItems } = await supabase
    .from('purchase_invoice_items')
    .select('id, product_name_raw, quantity, unit_cost, units_per_case, unit_type, box_weight_kg, purchase_invoices!inner(supplier_name)')
    .eq('is_matched', false)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())

  if (!rawItems?.length) return { autoApplied: 0, suggested: 0, decisions: [] }

  // 2. Confirmed mappings (the trusted knowledge base) + product retail prices +
  //    human-HELD mappings (pending/skipped). A pending or skipped row is a deliberate
  //    "leave this for a human" — typically because the exact-string matcher would
  //    over-generalise (e.g. "CARROTS - BABY PRE PACKS" is NOT loose carrots, but its
  //    only core noun "carrot" makes a generic confirmed sibling score 100%). The auto
  //    path used to upsert `confirmed` straight over these, silently reverting the
  //    correction the next morning. We now treat held keys as untouchable.
  const [{ data: confirmed }, { data: products }, { data: held }] = await Promise.all([
    supabase.from('supplier_product_mappings')
      .select('supplier_name, raw_description, product_id, unit_type, units_per_case, box_weight_kg')
      .eq('status', 'confirmed').not('product_id', 'is', null),
    supabase.from('products').select('id, name, retail_price').eq('is_active', true),
    supabase.from('supplier_product_mappings')
      .select('supplier_name, normalised_description')
      .in('status', ['pending', 'skipped']),
  ])

  // Keys a human (or a prior golem suggestion) is holding for review — never auto-map these.
  const heldKeys = new Set(
    (held ?? []).map((m: any) => `${normaliseSupplierName(m.supplier_name)}::${m.normalised_description}`),
  )

  const retail = new Map((products ?? []).map(p => [p.id, p.retail_price as number]))
  const pname  = new Map((products ?? []).map(p => [p.id, p.name as string]))
  // Only consider mappings whose product is still ACTIVE — never suggest/auto-map a
  // discontinued product (e.g. confirmed "RED CURRANT → Redcurrant" where Redcurrant
  // has been deactivated; those lines should go to a human, not a dead SKU).
  const maps = ((confirmed ?? []) as ConfirmedMapping[]).filter(m => retail.has(m.product_id))

  // Pre-compute core nouns per confirmed mapping once.
  const mapCore = maps.map(m => ({ m, core: coreNouns(m.raw_description) }))

  // 3. Group unmatched lines by (supplier, raw) so we decide once per distinct line.
  const groups = new Map<string, { supplier: string; raw: string; ids: string[]; unit_cost: number; qty: number; parsedUT: string | null; parsedUpc: number | null; parsedBw: number | null }>()
  for (const it of rawItems as any[]) {
    const supplier = (it.purchase_invoices as any)?.supplier_name ?? ''
    const key = `${normaliseSupplierName(supplier)}::${it.product_name_raw}`
    const g = groups.get(key)
    if (g) { g.ids.push(it.id); continue }
    groups.set(key, {
      supplier, raw: it.product_name_raw, ids: [it.id],
      unit_cost: it.unit_cost, qty: Number(it.quantity),
      parsedUT: it.unit_type, parsedUpc: it.units_per_case, parsedBw: it.box_weight_kg ? Number(it.box_weight_kg) : null,
    })
  }

  const decisions: MappingDecision[] = []

  for (const g of groups.values()) {
    const supKey = normaliseSupplierName(g.supplier)
    // Respect a human-held mapping: if this exact (supplier, line) is pending/skipped,
    // a person deliberately left it unconfirmed — do not auto-map or overwrite it.
    if (heldKeys.has(`${supKey}::${normaliseDescription(g.raw)}`)) {
      decisions.push({ supplier: g.supplier, raw: g.raw, itemIds: g.ids, action: 'skip', score: 0, reason: 'human-held mapping (pending/skipped) — left for review' })
      continue
    }
    const targetCore = new Set(coreNouns(g.raw))
    // junk lines (no product nouns, or zero qty/cost) → skip
    if (targetCore.size === 0 || g.qty === 0 || g.unit_cost === 0) {
      decisions.push({ supplier: g.supplier, raw: g.raw, itemIds: g.ids, action: 'skip', score: 0, reason: 'no product tokens / empty line' })
      continue
    }

    // Score every confirmed mapping; same supplier gets a small preference.
    const scored = mapCore.map(({ m, core }) => {
      let s = coverage(targetCore, core)
      // require a shared head noun (first core noun) to avoid cross-category bleed
      const head = core[0]
      if (head && !targetCore.has(head)) s = 0
      if (s > 0 && normaliseSupplierName(m.supplier_name) === supKey) s += 0.05
      return { m, s }
    }).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)

    if (scored.length === 0) {
      decisions.push({ supplier: g.supplier, raw: g.raw, itemIds: g.ids, action: 'skip', score: 0, reason: 'no confirmed sibling above threshold' })
      continue
    }

    // Consensus on product: best product_id and runner-up (different product).
    const byProduct = new Map<string, number>()
    for (const { m, s } of scored) byProduct.set(m.product_id, Math.max(byProduct.get(m.product_id) ?? 0, s))
    const ranked = [...byProduct.entries()].sort((a, b) => b[1] - a[1])
    const [topId, topScore] = ranked[0]
    const secondScore = ranked[1]?.[1] ?? 0

    // Basis by CONSENSUS across the winner's confirmed siblings — never from a
    // single closest row, because families like satsuma carry mixed/erroneous
    // bases (mostly weight/10kg, a few stray count/N). The majority is the truth;
    // if siblings genuinely disagree, that's a signal to ask a human, not guess.
    const sibs = scored.filter(x => x.m.product_id === topId).map(x => x.m)
    const votes = { count: 0, weight: 0 }
    for (const m of sibs) { if (m.unit_type === 'count') votes.count++; else if (m.unit_type === 'weight') votes.weight++ }
    const totalVotes = votes.count + votes.weight
    const modalUT: 'count' | 'weight' | null =
      totalVotes === 0 ? (g.parsedUT as 'count' | 'weight' | null)
      : votes.weight >= votes.count ? 'weight' : 'count'
    const consensus = totalVotes > 0 ? Math.max(votes.count, votes.weight) / totalVotes : (g.parsedUT ? 1 : 0)

    // Modal divisor among siblings that share the modal unit_type.
    const mode = (vals: (number | null)[]): number | null => {
      const m = new Map<number, number>(); let best: number | null = null, bc = 0
      for (const v of vals) if (v != null) m.set(v, (m.get(v) ?? 0) + 1)
      for (const [v, c] of m) if (c > bc) { bc = c; best = v }
      return best
    }
    const sameUT = sibs.filter(m => m.unit_type === modalUT)
    const modalDiv = mode(sameUT.map(m => (modalUT === 'weight' ? m.box_weight_kg : m.units_per_case) as number | null))

    // Prefer the item's own parsed divisor only when its parsed KIND matches the
    // consensus kind (parser reads the pack off the text); else use the modal.
    let upc: number | null = null, bw: number | null = null
    if (modalUT === 'count')  upc = (g.parsedUT === 'count'  && g.parsedUpc) ? g.parsedUpc : modalDiv
    if (modalUT === 'weight') bw  = (g.parsedUT === 'weight' && g.parsedBw)  ? g.parsedBw  : modalDiv
    const unitType = modalUT
    const closestRaw = sibs.map(m => ({ m, sim: fullSim(g.raw, m.raw_description) })).sort((a, b) => b.sim - a.sim)[0]?.m.raw_description ?? ''

    const divisor = unitType === 'weight' ? (bw ?? 0) : (upc ?? 0)
    const perUnit = divisor > 0 ? g.unit_cost / divisor : g.unit_cost
    const shelf = retail.get(topId) ?? 0
    const plausible = !(shelf >= 20 && perUnit >= shelf)   // cost>=shelf ⇒ likely contaminated

    const base = {
      supplier: g.supplier, raw: g.raw, itemIds: g.ids, productId: topId, productName: pname.get(topId),
      unitType: unitType ?? undefined, unitsPerCase: upc, boxWeightKg: bw, score: topScore,
    }

    // Auto only when: strong product match + clear basis consensus + usable basis + plausible.
    const strong = topScore >= 0.75 && (ranked.length === 1 || topScore - secondScore >= 0.2)
    const basisAgreed = consensus >= 0.7
    if (strong && basisAgreed && unitType && divisor > 0 && plausible) {
      decisions.push({ ...base, action: 'auto', reason: `matches confirmed "${closestRaw}" → ${pname.get(topId)} (${unitType}${unitType === 'count' ? `/${upc}` : `/${bw}kg`}, ${Math.round(consensus * 100)}% basis consensus)` })
    } else if (topScore >= 0.6) {
      const why = !plausible ? 'cost ≥ shelf — needs a human eye'
        : !basisAgreed ? 'siblings disagree on box size'
        : !unitType || divisor <= 0 ? 'unit basis unclear'
        : 'product not unambiguous enough'
      decisions.push({ ...base, action: 'suggest', reason: `likely ${pname.get(topId)} (${why})` })
    } else {
      decisions.push({ supplier: g.supplier, raw: g.raw, itemIds: g.ids, action: 'skip', score: topScore, reason: 'below confidence' })
    }
  }

  // 4. Apply (unless dry run).
  let autoApplied = 0, suggested = 0
  for (const d of decisions) {
    if (d.action === 'auto') autoApplied += d.itemIds.length
    if (d.action === 'suggest') suggested += 1
    if (dryRun) continue

    if (d.action === 'auto' && d.productId) {
      // Confirm the mapping (so future lines exact-match) …
      await supabase.from('supplier_product_mappings').upsert({
        supplier_name: normaliseSupplierName(d.supplier), raw_description: d.raw,
        normalised_description: normaliseDescription(d.raw), product_id: d.productId,
        status: 'confirmed', unit_type: d.unitType, units_per_case: d.unitsPerCase ?? null,
        box_weight_kg: d.boxWeightKg ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'supplier_name,normalised_description' })
      // … and match the invoice line(s) with the inherited basis.
      await supabase.from('purchase_invoice_items').update({
        product_id: d.productId, is_matched: true, unit_type: d.unitType,
        units_per_case: d.unitsPerCase ?? null, box_weight_kg: d.boxWeightKg ?? null,
      }).in('id', d.itemIds)
    } else if (d.action === 'suggest' && d.productId) {
      // Pre-fill a PENDING mapping for one-tap review on /invoice-mapping.
      await supabase.from('supplier_product_mappings').upsert({
        supplier_name: normaliseSupplierName(d.supplier), raw_description: d.raw,
        normalised_description: normaliseDescription(d.raw), product_id: d.productId,
        status: 'pending', unit_type: d.unitType ?? null, units_per_case: d.unitsPerCase ?? null,
        box_weight_kg: d.boxWeightKg ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'supplier_name,normalised_description', ignoreDuplicates: true })
    }
  }

  return { autoApplied, suggested, decisions }
}
