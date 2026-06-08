'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function applySuggestion(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, id: string) {
  const { data: suggestion } = await supabase
    .from('price_suggestions')
    .select('product_id, suggested_retail_price')
    .eq('id', id)
    .single()

  if (!suggestion) return

  await supabase
    .from('products')
    .update({ retail_price: suggestion.suggested_retail_price })
    .eq('id', suggestion.product_id)

  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('price_suggestions')
    .update({ status: 'approved', applied_at: new Date().toISOString(), applied_by: user?.id })
    .eq('id', id)
}

export async function approveSuggestion(id: string) {
  const supabase = await createClient()
  await applySuggestion(supabase, id)
  revalidatePath('/pricing')
}

export async function rejectSuggestion(id: string) {
  const supabase = await createClient()
  await supabase
    .from('price_suggestions')
    .update({ status: 'rejected' })
    .eq('id', id)
  revalidatePath('/pricing')
}

export async function approveAll() {
  const supabase = await createClient()
  const { data: pending } = await supabase
    .from('price_suggestions')
    .select('id')
    .eq('status', 'pending')

  for (const s of pending ?? []) {
    await applySuggestion(supabase, s.id)
  }

  revalidatePath('/pricing')
}

export async function rejectAll() {
  const supabase = await createClient()
  await supabase
    .from('price_suggestions')
    .update({ status: 'rejected' })
    .eq('status', 'pending')
  revalidatePath('/pricing')
}

export async function recalculateSuggestions() {
  const supabase = await createClient()

  // Load all active products with a cost set
  const { data: products } = await supabase
    .from('products')
    .select('id, purchase_cost, retail_price, price_multiplier, market_ceiling, margin_floor, case_size')
    .eq('is_active', true)
    .gt('purchase_cost', 0)

  if (!products?.length) { revalidatePath('/pricing'); return }

  // Clear existing pending suggestions so we start fresh
  await supabase.from('price_suggestions').delete().eq('status', 'pending')

  const now = new Date().toISOString()
  const toInsert = []

  for (const p of products) {
    const unit_cost = p.purchase_cost
    const suggested = Math.round(unit_cost * p.price_multiplier)
    const capped    = p.market_ceiling ? Math.min(suggested, p.market_ceiling) : suggested

    // Never suggest a price at or below cost
    if (capped <= unit_cost) continue

    const currentMargin = p.retail_price > 0
      ? (p.retail_price - unit_cost) / p.retail_price
      : -1
    const isUnpriced   = p.retail_price === 0
    const isBelowFloor = currentMargin < p.margin_floor
    const isAboveCeiling = p.market_ceiling !== null && p.retail_price > p.market_ceiling

    // Only suggest when there's actually a problem — not just because multiplier differs
    if (!isUnpriced && !isBelowFloor && !isAboveCeiling) continue

    // Skip if already at the right price (within 5p)
    if (Math.abs(capped - p.retail_price) <= 5) continue

    const margin = capped > 0 ? (capped - unit_cost) / capped : 0

    toInsert.push({
      product_id:             p.id,
      current_retail_price:   p.retail_price,
      suggested_retail_price: capped,
      rule_applied:           p.market_ceiling && suggested > p.market_ceiling ? 'ceiling' : margin < p.margin_floor ? 'floor' : 'multiplier',
      margin_percentage:      margin,
      margin_warning:         margin < p.margin_floor,
      status:                 'pending',
      created_at:             now,
    })
  }

  if (toInsert.length) {
    await supabase.from('price_suggestions').insert(toInsert)
  }

  revalidatePath('/pricing')
}

export async function amendAndApproveSuggestion(id: string, formData: FormData) {
  const raw = formData.get('price_pounds') as string
  const customPrice = Math.round(parseFloat(raw) * 100)
  if (!customPrice || customPrice <= 0) return

  const supabase = await createClient()

  const { data: suggestion } = await supabase
    .from('price_suggestions')
    .select('product_id')
    .eq('id', id)
    .single()

  if (!suggestion) return

  await supabase
    .from('products')
    .update({ retail_price: customPrice })
    .eq('id', suggestion.product_id)

  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('price_suggestions')
    .update({
      suggested_retail_price: customPrice,
      status:     'approved',
      applied_at: new Date().toISOString(),
      applied_by: user?.id,
    })
    .eq('id', id)

  revalidatePath('/pricing')
}
