import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram'

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

  // Alert if order placed during market hours (07:40–13:00) — David may need to buy extra
  const nowHour = new Date().getHours()
  const nowMin  = new Date().getMinutes()
  const inMarketWindow = (nowHour > 7 || (nowHour === 7 && nowMin >= 40)) && nowHour < 13
  if (inMarketWindow) {
    const { data: customer } = await supabase
      .from('wholesale_customers').select('name').eq('id', customer_id).single()
    const { data: productRows } = await supabase
      .from('wholesale_order_items')
      .select('quantity, product:products(name)')
      .eq('order_id', order.id)
    const itemSummary = (productRows ?? [])
      .map((i: any) => `${Number(i.quantity)}× ${(i.product as any)?.name ?? '?'}`)
      .join(', ')
    const dueLabel = delivery_date ?? 'no date'
    sendTelegram(
      `⚡ <b>Last-minute order while David is at market!</b>\n<b>${customer?.name ?? 'Unknown'}</b> (due: ${dueLabel})\n${itemSummary}\n\nCall David now if he hasn't left the market yet.`
    ).catch(() => {})
  }

  return NextResponse.json(order)
}
