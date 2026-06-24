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
  total_pence: number
  payment_method: 'cash' | 'card'
  cash_tendered_pence: number | null
  change_pence: number | null
  items: TransactionItem[]
}

export type RecordResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function recordTransaction(input: RecordTransactionInput): Promise<RecordResult> {
  const supabase = await createClient()

  const { data: tx, error } = await supabase
    .from('till_transactions')
    .insert({
      total_pence: input.total_pence,
      payment_method: input.payment_method,
      cash_tendered_pence: input.cash_tendered_pence,
      change_pence: input.change_pence,
      status: 'completed',
    })
    .select('id')
    .single()

  if (error || !tx) {
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
