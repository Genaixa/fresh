import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Question ledger + auto-resolver — so David is only ever asked genuine unknowns.
 *
 * Born from 25 Jun: we re-opened "Soraya = Potato Washed" (already settled the
 * day before) and nearly asked David to re-export a file we already had on disk.
 * See memory feedback_dont_reask_david.
 *
 *   v1 (gate):     addQuestion() refuses duplicates (dedup_key UNIQUE) and won't
 *                  re-raise anything already answered.
 *   v2 (resolver): resolveOpenQuestions() drafts an answer from data — invoices
 *                  (cost / pack spec) and the EPOS-synced retail price — and
 *                  auto-closes questions data can now answer. Judgment calls
 *                  (unit basis, loss-leaders, mappings) are NEVER auto-answered;
 *                  they stay open for David.
 */

export type QuestionCategory =
  | 'cost' | 'retail_price' | 'pack_spec' | 'mapping' | 'unit_basis' | 'judgment' | 'other'

export interface DavidQuestion {
  id: string
  question: string
  category: QuestionCategory
  product_id: string | null
  status: 'open' | 'auto_resolved' | 'answered' | 'dismissed'
  proposed_answer: string | null
  evidence: string | null
  answer: string | null
}

/** Categories a human must decide — data can never settle these. */
const JUDGMENT_ONLY: QuestionCategory[] = ['unit_basis', 'judgment', 'mapping']

export function normaliseQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const gbp = (p: number) => `£${(p / 100).toFixed(2)}`

export interface AddResult { outcome: 'created' | 'duplicate' | 'already_answered' }

/** v1 gate: raise a question only if it isn't already in the ledger.
 *  Returns 'already_answered' if a prior identical question was resolved/answered. */
export async function addQuestion(
  supabase: SupabaseClient,
  q: { question: string; category?: QuestionCategory; product_id?: string | null },
): Promise<AddResult> {
  const key = normaliseQuestion(q.question)
  const { data: existing } = await supabase
    .from('david_questions')
    .select('id, status, times_surfaced')
    .eq('dedup_key', key)
    .maybeSingle()

  if (existing) {
    // Record that we hit this again, so repeat-ask pressure is visible.
    await supabase.from('david_questions')
      .update({ times_surfaced: (existing.times_surfaced ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (existing.status === 'answered' || existing.status === 'auto_resolved') {
      return { outcome: 'already_answered' }
    }
    return { outcome: 'duplicate' }
  }

  await supabase.from('david_questions').insert({
    question: q.question,
    category: q.category ?? 'other',
    product_id: q.product_id ?? null,
    dedup_key: key,
  })
  return { outcome: 'created' }
}

export interface ResolveDigest {
  autoResolved: { question: string; proposed: string; evidence: string }[]
  stillOpen:    { question: string; category: QuestionCategory }[]
}

/** v2 resolver: try to answer each open question from data; auto-close the ones
 *  we can. Run nightly from the integrity-check golem. Read-mostly: only writes
 *  to david_questions (proposed_answer / status), never to products. */
export async function resolveOpenQuestions(supabase: SupabaseClient): Promise<ResolveDigest> {
  const digest: ResolveDigest = { autoResolved: [], stillOpen: [] }

  const { data: open } = await supabase
    .from('david_questions')
    .select('id, question, category, product_id, status')
    .eq('status', 'open')
  if (!open?.length) return digest

  for (const q of open as DavidQuestion[]) {
    if (JUDGMENT_ONLY.includes(q.category) || !q.product_id) {
      digest.stillOpen.push({ question: q.question, category: q.category })
      continue
    }

    const drafted = await draftAnswer(supabase, q.category, q.product_id)
    if (drafted) {
      await supabase.from('david_questions').update({
        status: 'auto_resolved',
        proposed_answer: drafted.answer,
        evidence: drafted.evidence,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', q.id)
      digest.autoResolved.push({ question: q.question, proposed: drafted.answer, evidence: drafted.evidence })
    } else {
      digest.stillOpen.push({ question: q.question, category: q.category })
    }
  }
  return digest
}

/** Draft an answer for a data-answerable question, or null if data can't settle it. */
async function draftAnswer(
  supabase: SupabaseClient,
  category: QuestionCategory,
  productId: string,
): Promise<{ answer: string; evidence: string } | null> {
  if (category === 'cost' || category === 'pack_spec') {
    // The cost view already holds the latest box price + pack spec.
    const { data: li } = await supabase
      .from('product_last_invoice')
      .select('box_price_pence, unit_type, box_weight_kg, units_per_case, invoice_date')
      .eq('product_id', productId)
      .maybeSingle()
    if (!li?.box_price_pence) return null

    if (category === 'pack_spec') {
      const spec = li.unit_type === 'weight'
        ? `${li.box_weight_kg ?? '?'} kg/box`
        : `${li.units_per_case ?? '?'} units/box`
      return {
        answer: spec,
        evidence: `Last invoice ${li.invoice_date}: box ${gbp(li.box_price_pence)}, ${spec}.`,
      }
    }

    // cost → per-unit, only if the pack spec lets us divide and the result is sane
    const divisor = li.unit_type === 'weight' ? Number(li.box_weight_kg) : Number(li.units_per_case)
    if (!divisor || divisor <= 0) return null
    const perUnit = Math.round(li.box_price_pence / divisor)

    const { data: prod } = await supabase
      .from('products').select('retail_price').eq('id', productId).maybeSingle()
    const retail = prod?.retail_price ?? 0
    // Guard against unit-mismatch garbage: implausible margins mean don't trust it.
    if (retail > 0) {
      const margin = (retail - perUnit) / retail
      if (margin < -0.1 || margin > 0.97) return null
    }
    return {
      answer: `${gbp(perUnit)} per ${li.unit_type === 'weight' ? 'kg' : 'unit'}`,
      evidence: `Last invoice ${li.invoice_date}: ${gbp(li.box_price_pence)} ÷ ${divisor}${li.unit_type === 'weight' ? 'kg' : ' units'}.`,
    }
  }

  if (category === 'retail_price') {
    // EPOS is the source of truth for retail; if it's already synced, that's the answer.
    const { data: prod } = await supabase
      .from('products').select('retail_price, epos_now_id').eq('id', productId).maybeSingle()
    if (prod?.retail_price && prod.epos_now_id) {
      return {
        answer: gbp(prod.retail_price),
        evidence: `Already set from EPOS (button ${prod.epos_now_id}).`,
      }
    }
    return null
  }

  return null
}
