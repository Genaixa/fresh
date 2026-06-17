import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// David's own shop-floor order. Recorded against the internal "Shop Floor"
// customer so it flows into /market-run's demand like any wholesale order.
// Demand only — no prices (unit_price 0, unit_type defaults to retail_unit);
// market-run converts the loose units to boxes. Status 'confirmed' so it shows
// in the buying list. No Telegram (this is David's own demand, not a customer).
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const items = (Array.isArray(body?.items) ? body.items : [])
    .map((i: any) => ({ product_id: i?.product_id as string, quantity: Math.round(Number(i?.quantity) || 0) }))
    .filter((i: any) => i.product_id && i.quantity > 0 && i.quantity <= 9999)
  if (items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

  // Resolve the Shop Floor customer server-side — don't trust a client id.
  const { data: shop } = await supabase
    .from('wholesale_customers')
    .select('id')
    .eq('name', 'Fresh & Fruity – Shop Floor')
    .single()
  if (!shop) return NextResponse.json({ error: 'Shop Floor account missing' }, { status: 500 })

  const { data: order, error: orderErr } = await supabase
    .from('wholesale_orders')
    .insert({
      customer_id:   shop.id,
      delivery_date: body?.delivery_date || null,
      notes:         body?.notes ? String(body.notes).slice(0, 1000) : null,
      status:        'confirmed',
      created_by:    user.id,
    })
    .select('id')
    .single()
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  const { error: itemErr } = await supabase.from('wholesale_order_items').insert(
    items.map((i: any) => ({ order_id: order.id, product_id: i.product_id, quantity: i.quantity, unit_price: 0 }))
  )
  if (itemErr) {
    await supabase.from('wholesale_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: order.id })
}
