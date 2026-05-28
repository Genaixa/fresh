import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('wholesale_orders')
    .select(`
      *,
      customer:wholesale_customers(*),
      items:wholesale_order_items(*, product:products(id, name, unit)),
      invoice:wholesale_invoices(id, invoice_number)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Flatten invoice id
  const invoice = Array.isArray(data.invoice) ? data.invoice[0] : data.invoice
  return NextResponse.json({ ...data, invoice_id: invoice?.id ?? null })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('wholesale_orders')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
