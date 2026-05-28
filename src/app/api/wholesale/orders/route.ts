import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customer_id, order_date, delivery_date, notes, status, items } = body

  if (!customer_id) return NextResponse.json({ error: 'Customer required' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'No items' }, { status: 400 })

  const { data: order, error: orderErr } = await supabase
    .from('wholesale_orders')
    .insert({ customer_id, order_date, delivery_date, notes, status: status ?? 'draft', created_by: user.id })
    .select()
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  const lineItems = items.map((i: any) => ({
    order_id:   order.id,
    product_id: i.product_id,
    quantity:   i.quantity,
    unit_price: i.unit_price,
  }))

  const { error: itemErr } = await supabase.from('wholesale_order_items').insert(lineItems)
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })

  return NextResponse.json(order)
}
