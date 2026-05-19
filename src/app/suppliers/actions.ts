'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function upsertSupplier(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const payload = {
    name:         (formData.get('name') as string).trim(),
    market_order: formData.get('market_order')
                    ? parseInt(formData.get('market_order') as string, 10)
                    : null,
    is_active:    formData.get('is_active') === 'true',
  }

  if (id) {
    await supabase.from('suppliers').update(payload).eq('id', id)
  } else {
    await supabase.from('suppliers').insert(payload)
  }

  revalidatePath('/suppliers')
}

export async function toggleSupplierActive(id: string, is_active: boolean) {
  const supabase = await createClient()
  await supabase.from('suppliers').update({ is_active }).eq('id', id)
  revalidatePath('/suppliers')
}
