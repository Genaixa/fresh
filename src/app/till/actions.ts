'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface TransactionItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  unit_price_pence: number
  line_total_pence: number
}

interface RecordTransactionInput {
  /** Client-generated idempotency key — same sale retried = no-op (see 0106). */
  client_uuid: string
  total_pence: number
  payment_method: 'cash' | 'card'
  cash_tendered_pence: number | null
  change_pence: number | null
  items: TransactionItem[]
}

export type RecordResult =
  | { ok: true; id: string; duplicate?: boolean }
  | { ok: false; error: string }

export async function recordTransaction(input: RecordTransactionInput): Promise<RecordResult> {
  const supabase = await createClient()

  const { data: tx, error } = await supabase
    .from('till_transactions')
    .insert({
      client_uuid: input.client_uuid,
      total_pence: input.total_pence,
      payment_method: input.payment_method,
      cash_tendered_pence: input.cash_tendered_pence,
      change_pence: input.change_pence,
      status: 'completed',
    })
    .select('id')
    .single()

  if (error || !tx) {
    // 23505 = unique violation on client_uuid → this sale is already recorded.
    // Treat as success (idempotent): a re-synced offline sale must not duplicate.
    if (error?.code === '23505') {
      const { data: existing } = await supabase
        .from('till_transactions')
        .select('id')
        .eq('client_uuid', input.client_uuid)
        .single()
      if (existing) return { ok: true, id: existing.id, duplicate: true }
    }
    return { ok: false, error: error?.message ?? 'Could not save the sale' }
  }

  const { error: itemsError } = await supabase.from('till_transaction_items').insert(
    input.items.map(item => ({
      transaction_id: tx.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_pence: item.unit_price_pence,
      line_total_pence: item.line_total_pence,
    }))
  )

  if (itemsError) {
    // Header saved but lines didn't — void the orphan so it can't skew the day's
    // takings, and tell the cashier to re-ring rather than silently lose the sale.
    await supabase.from('till_transactions').update({ status: 'voided' }).eq('id', tx.id)
    return { ok: false, error: 'Could not save the sale lines — please re-ring' }
  }

  revalidatePath('/till/sales')
  return { ok: true, id: tx.id }
}

export async function voidTransaction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('till_transactions')
    .update({ status: 'voided' })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/till/sales')
  return { ok: true }
}
