'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function confirmMapping(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id           = formData.get('id') as string
  const product_id   = formData.get('product_id') as string | null
  const unit_type    = formData.get('unit_type') as 'count' | 'weight'
  const raw_count    = formData.get('units_per_case') as string | null
  const raw_weight   = formData.get('box_weight_kg') as string | null
  const epos_now_id  = (formData.get('epos_now_id') as string | null)?.trim() || null

  if (!id || !product_id) return

  await supabase
    .from('supplier_product_mappings')
    .update({
      product_id,
      status:          'confirmed',
      confirmed_by:    user.id,
      unit_type,
      units_per_case:  unit_type === 'count' && raw_count  ? parseInt(raw_count)   : null,
      box_weight_kg:   unit_type === 'weight' && raw_weight ? parseFloat(raw_weight) : null,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', id)

  // Also update epos_now_id on the product if supplied
  if (epos_now_id !== undefined) {
    await supabase
      .from('products')
      .update({ epos_now_id })
      .eq('id', product_id)
  }

  revalidatePath('/invoice-mapping')
  revalidatePath('/dashboard')
}

export async function skipMapping(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  if (!id) return

  await supabase
    .from('supplier_product_mappings')
    .update({ status: 'skipped', updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/invoice-mapping')
  revalidatePath('/dashboard')
}

export async function deleteMapping(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = formData.get('id') as string
  if (!id) return

  await supabase.from('supplier_product_mappings').delete().eq('id', id)

  revalidatePath('/invoice-mapping')
  revalidatePath('/dashboard')
}
