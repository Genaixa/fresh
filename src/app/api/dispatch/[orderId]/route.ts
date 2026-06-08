import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateInvoiceFromOrder } from '@/lib/wholesale'

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { items } = body as {
    items: { product_id: string; quantity: number; unit_price: number; unit_type: string | null }[]
  }

  if (!items?.length) return NextResponse.json({ error: 'No items to dispatch' }, { status: 400 })

  const { data: order } = await supabase
    .from('wholesale_orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'dispatched') return NextResponse.json({ error: 'Already dispatched' }, { status: 400 })

  // Replace items with what was actually handed over
  const { error: delErr } = await supabase
    .from('wholesale_order_items')
    .delete()
    .eq('order_id', orderId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const newItems = items.map(i => ({
    order_id:   orderId,
    product_id: i.product_id,
    quantity:   i.quantity,
    unit_price: i.unit_price,
    unit_type:  i.unit_type,
  }))

  const { error: insertErr } = await supabase.from('wholesale_order_items').insert(newItems)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  try {
    const invoice = await generateInvoiceFromOrder(orderId)
    return NextResponse.json({ invoice_id: invoice.id, invoice_number: invoice.invoice_number })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
