'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function upsertMarketItem(data: {
  sessionId:   string
  productId:   string
  entryIndex:  number
  supplierId:  string | null
  qtyBoxes:    number
  pricePence:  number
  dealStatus:  'green' | 'amber' | 'red' | null
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('market_session_items')
    .upsert(
      {
        session_id:  data.sessionId,
        product_id:  data.productId,
        entry_index: data.entryIndex,
        supplier_id: data.supplierId,
        qty_boxes:   data.qtyBoxes,
        price_pence: data.pricePence,
        deal_status: data.dealStatus,
      },
      { onConflict: 'session_id,product_id,entry_index' }
    )
  if (error) throw error
}

export async function deleteMarketItem(data: {
  sessionId:  string
  productId:  string
  entryIndex: number
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('market_session_items')
    .delete()
    .eq('session_id', data.sessionId)
    .eq('product_id', data.productId)
    .eq('entry_index', data.entryIndex)
  if (error) throw error
}

export async function completeSectionBatch(sessionId: string, section: 'roots' | 'veg' | 'fruit', newCount: number) {
  const supabase = await createClient()
  await supabase
    .from('market_sessions')
    .update({ [`${section}_batches`]: newCount })
    .eq('id', sessionId)
}

export async function closeMarketSession(sessionId: string) {
  const supabase = await createClient()
  await supabase
    .from('market_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  revalidatePath('/market')
}
