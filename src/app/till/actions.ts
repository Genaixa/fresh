'use server'

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

export async function recordTransaction(input: RecordTransactionInput) {
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

  if (error || !tx) return

  await supabase.from('till_transaction_items').insert(
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
}
