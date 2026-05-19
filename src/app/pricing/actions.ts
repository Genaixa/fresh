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
