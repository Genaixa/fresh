import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram'
import { suggestedWholesalePrice, WHOLESALE_FIXED } from '@/lib/wholesale-pricing'
import { CONFIG } from '@/app/market/config'

// Customer-facing order submission. The customer never sees or sets prices —
// we resolve their account from the session and price each line from what DAVID
// pays: box = his latest supplier box cost + markup tier (or fixed override),
// loose = shop retail. Same rule as David's own order screen. Cost data is read
// with the service client so the customer session never sees supplier costs.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('portal_user_id', user.id)
    .single()
  if (!customer) {
    return NextResponse.json({ error: 'No wholesale account linked to this login' }, { status: 403 })
  }

  const body = await req.json()
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i: any) => ({
      product_id: i.product_id as string,
      quantity:   Number(i.quantity) || 0,
      unit_type:  i.unit_type === 'box' ? 'box' : 'retail_unit',
    }))
    .filter((i: any) => i.product_id && i.quantity > 0)

  if (items.length === 0) return NextResponse.json({ error: 'Your order is empty' }, { status: 400 })

  const productIds = [...new Set(items.map((i: any) => i.product_id))]

  // Price each line from what DAVID pays, using the service client so supplier
  // costs are never exposed to the customer session.
  const admin = createServiceClient()
  const { data: prods } = await admin
    .from('products')
    .select('id, name, retail_price, case_size')
    .in('id', productIds)
  const prodMap = new Map((prods ?? []).map(p => [p.id, p]))

  // David's latest (cheapest) supplier box cost per product
  const { data: lastPrices } = await admin
    .from('product_supplier_last_price')
    .select('product_id, last_price_p')
    .in('product_id', productIds)
  const boxCostMap = new Map<string, number>()
  for (const row of lastPrices ?? []) {
    const ex = boxCostMap.get(row.product_id)
    if (ex == null || row.last_price_p < ex) boxCostMap.set(row.product_id, row.last_price_p)
  }

  // Box lines we had to price by guesswork (no supplier cost, no fixed price) —
  // David gets warned so he can check these before the invoice goes out.
  const estimated: string[] = []

  function priceFor(productId: string, unitType: 'box' | 'retail_unit'): number {
    const p = prodMap.get(productId)
    if (!p) return 0
    if (unitType === 'box' && boxCostMap.get(productId) == null && WHOLESALE_FIXED[p.name] == null) {
      estimated.push(p.name)
    }
    return suggestedWholesalePrice({
      name:            p.name,
      unitType,
      retailPence:     p.retail_price,
      boxCostPence:    boxCostMap.get(productId) ?? null,
      typicalBoxCount: CONFIG[p.name]?.typicalBoxCount ?? (p.case_size ?? 1),
    })
  }

  const { data: order, error: orderErr } = await supabase
    .from('wholesale_orders')
    .insert({
      customer_id:   customer.id,
      delivery_date: body.delivery_date || null,
      notes:         body.notes || null,
      status:        'confirmed',
      created_by:    user.id,
    })
    .select('id')
    .single()
  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  const lineItems = items.map((i: any) => ({
    order_id:   order.id,
    product_id: i.product_id,
    quantity:   i.quantity,
    unit_type:  i.unit_type,
    unit_price: priceFor(i.product_id, i.unit_type),
  }))

  const { error: itemErr } = await supabase.from('wholesale_order_items').insert(lineItems)
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })

  const note = (body.notes || '').trim()
  const estWarn = estimated.length
    ? `\n⚠️ <b>Check price</b> (no known cost): ${[...new Set(estimated)].join(', ')}`
    : ''
  sendTelegram(
    `🧺 <b>Portal order — ${customer.name}</b>\nDelivery: ${body.delivery_date || 'not set'}\n${lineItems.length} item${lineItems.length === 1 ? '' : 's'}` +
    (note ? `\n📝 ${note}` : '') +
    estWarn
  ).catch(() => {})

  return NextResponse.json({ id: order.id })
}
