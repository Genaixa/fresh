'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { regenerateSuggestions } from '@/lib/pricing-engine'

async function applySuggestion(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, id: string) {
  const { data: suggestion } = await supabase
    .from('price_suggestions')
    .select('product_id, suggested_retail_price, product:products(purchase_cost, price_multiplier, market_ceiling)')
    .eq('id', id)
    .single()

  if (!suggestion) return

  // Recompute the price from the product's CURRENT cost × multiplier rather than
  // trusting the stored value — the stored figure can be stale if the cost was
  // corrected after the suggestion was generated. This guarantees Approve All can
  // never write an out-of-date price to the shelf. Falls back to the stored value
  // only when cost data is missing.
  const prod = suggestion.product as unknown as
    { purchase_cost: number | null; price_multiplier: number | null; market_ceiling: number | null } | null
  const cost = prod?.purchase_cost ?? 0
  const mult = prod?.price_multiplier ?? 2
  let priceToApply = suggestion.suggested_retail_price
  if (cost > 0) {
    const raw = Math.round(cost * mult)
    priceToApply = prod?.market_ceiling ? Math.min(raw, prod.market_ceiling) : raw
  }

  await supabase
    .from('products')
    .update({ retail_price: priceToApply })
    .eq('id', suggestion.product_id)

  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('price_suggestions')
    .update({ status: 'approved', suggested_retail_price: priceToApply, applied_at: new Date().toISOString(), applied_by: user?.id })
    .eq('id', id)
}

export async function approveSuggestion(id: string) {
  const supabase = await createClient()
  await applySuggestion(supabase, id)
  revalidatePath('/pricing')
}

// Apply a withheld suggestion's price despite the plausibility guard. Routes the
// write through apply_retail_override (sets app.bypass_price_guard for that txn)
// so the retail-write trigger lets it through — an explicit, audited override.
export async function approveWithheldAnyway(id: string, pricePence: number) {
  if (!pricePence || pricePence <= 0) return
  const supabase = await createClient()

  const { data: suggestion } = await supabase
    .from('price_suggestions')
    .select('product_id')
    .eq('id', id)
    .single()
  if (!suggestion) return

  const { error } = await supabase.rpc('apply_retail_override', {
    p_id: suggestion.product_id,
    p_price: pricePence,
  })
  if (error) { console.error('[approveWithheldAnyway]', error.message); return }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase
    .from('price_suggestions')
    .update({
      suggested_retail_price: pricePence,
      status: 'approved',
      applied_at: new Date().toISOString(),
      applied_by: user?.id,
    })
    .eq('id', id)

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

export async function holdSuggestion(id: string) {
  const supabase = await createClient()
  await supabase.from('price_suggestions').update({ status: 'on_hold' }).eq('id', id)
  revalidatePath('/pricing')
}

export async function unholdSuggestion(id: string) {
  const supabase = await createClient()
  await supabase.from('price_suggestions').update({ status: 'pending' }).eq('id', id)
  revalidatePath('/pricing')
}

export async function approveAll() {
  const supabase = await createClient()
  // Bulk approve excludes below-floor (margin_warning) rows — those drop margin
  // under the product's floor and must be an explicit, individual decision, never
  // swept up in "Approve All". They stay pending with their own ✓.
  const { data: pending } = await supabase
    .from('price_suggestions')
    .select('id')
    .eq('status', 'pending')
    .eq('margin_warning', false)

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
  await regenerateSuggestions(supabase)
  revalidatePath('/pricing')
}

export async function dismissOpportunity(productId: string) {
  const supabase = await createClient()
  // Fetch current cost so we can store it — card re-appears when cost changes by 10p+
  const { data: product } = await supabase
    .from('products')
    .select('purchase_cost')
    .eq('id', productId)
    .single()
  if (!product) return
  await supabase
    .from('products')
    .update({ wins_dismissed_cost: product.purchase_cost })
    .eq('id', productId)
  revalidatePath('/pricing')
}

export async function setOpportunityPrice(productId: string, pricePence: number) {
  if (!productId || pricePence <= 0) return
  const supabase = await createClient()
  await supabase.from('products').update({ retail_price: pricePence }).eq('id', productId)
  revalidatePath('/pricing')
  revalidatePath('/dashboard')
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
