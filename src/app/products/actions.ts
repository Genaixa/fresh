'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { regenerateSuggestions } from '@/lib/pricing-engine'

export async function upsertProduct(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const poundsToP = (val: FormDataEntryValue | null) =>
    Math.round(parseFloat(val as string) * 100) || 0

  const payload = {
    name:             formData.get('name') as string,
    category:         formData.get('category') as string,
    market_section:   (formData.get('market_section') as string) || (formData.get('category') as string),
    unit:             formData.get('unit') as string,
    retail_price:     poundsToP(formData.get('retail_price')),
    wholesale_price:  poundsToP(formData.get('wholesale_price')),
    purchase_cost:    poundsToP(formData.get('purchase_cost')),
    case_size:        parseInt(formData.get('case_size') as string, 10) || 1,
    price_multiplier: parseFloat(formData.get('price_multiplier') as string) || 2.0,
    market_ceiling:   (() => {
                        const v = poundsToP(formData.get('market_ceiling'))
                        return v > 0 ? v : null
                      })(),
    margin_floor:     parseFloat(formData.get('margin_floor') as string) / 100 || 0.20,
    epos_now_id:           (formData.get('epos_now_id') as string) || null,
    plu_code:              parseInt(formData.get('plu_code') as string, 10) || null,
    vat_rate_bps:          Math.round((parseFloat(formData.get('vat_rate') as string) || 0) * 100),
    default_supplier_id:   (formData.get('default_supplier_id') as string) || null,
  }

  let productId = id
  if (id) {
    await supabase.from('products').update(payload).eq('id', id)
  } else {
    const { data: inserted } = await supabase.from('products').insert(payload).select('id').single()
    productId = inserted?.id ?? null
  }

  // Refresh this product's pending suggestions against the just-saved cost /
  // multiplier / ceiling so the /pricing list can never show a stale figure for it.
  if (productId) await regenerateSuggestions(supabase, [productId])

  revalidatePath('/products')
  revalidatePath('/pricing')
  redirect('/products')
}

export async function deactivateProduct(id: string) {
  const supabase = await createClient()
  await supabase.from('products').update({ is_active: false }).eq('id', id)
  revalidatePath('/products')
  redirect('/products')
}
