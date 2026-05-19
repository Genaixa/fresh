'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertProduct(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const payload = {
    name:             formData.get('name') as string,
    category:         formData.get('category') as string,
    unit:             formData.get('unit') as string,
    retail_price:     parseInt(formData.get('retail_price') as string, 10),
    wholesale_price:  parseInt(formData.get('wholesale_price') as string, 10) || 0,
    purchase_cost:    parseInt(formData.get('purchase_cost') as string, 10),
    price_multiplier: parseFloat(formData.get('price_multiplier') as string) || 2.0,
    market_ceiling:   formData.get('market_ceiling')
                        ? parseInt(formData.get('market_ceiling') as string, 10)
                        : null,
    margin_floor:     parseFloat(formData.get('margin_floor') as string) / 100 || 0.20,
    epos_now_id:      (formData.get('epos_now_id') as string) || null,
  }

  if (id) {
    await supabase.from('products').update(payload).eq('id', id)
  } else {
    await supabase.from('products').insert(payload)
  }

  revalidatePath('/products')
  redirect('/products')
}

export async function deactivateProduct(id: string) {
  const supabase = await createClient()
  await supabase.from('products').update({ is_active: false }).eq('id', id)
  revalidatePath('/products')
  redirect('/products')
}
