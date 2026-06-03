'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertOrder(
  customerId: string,
  deliveryDate: string,
  items: { productId: string; quantity: number; unitType: 'box' | 'retail_unit'; unitPrice: number }[]
) {
  const supabase = await createClient()

  // Create or find today's draft order for this customer
  const { data: existing } = await supabase
    .from('wholesale_orders')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'draft')
    .eq('order_date', new Date().toISOString().split('T')[0])
    .single()

  let orderId: string

  if (existing) {
    orderId = existing.id
    // Delete existing items to replace with new ones
    await supabase.from('wholesale_order_items').delete().eq('order_id', orderId)
  } else {
    const { data: created, error } = await supabase
      .from('wholesale_orders')
      .insert({ customer_id: customerId, delivery_date: deliveryDate, status: 'draft' })
      .select('id')
      .single()
    if (error || !created) throw new Error('Failed to create order')
    orderId = created.id
  }

  if (items.length > 0) {
    await supabase.from('wholesale_order_items').insert(
      items.map(i => ({
        order_id:   orderId,
        product_id: i.productId,
        quantity:   i.quantity,
        unit_type:  i.unitType,
        unit_price: i.unitPrice,
      }))
    )
  }

  revalidatePath('/order')
  revalidatePath('/market')
  return orderId
}

export async function confirmOrder(orderId: string) {
  const supabase = await createClient()
  await supabase
    .from('wholesale_orders')
    .update({ status: 'confirmed' })
    .eq('id', orderId)
  revalidatePath('/order')
  revalidatePath('/market')
}
