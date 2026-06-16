import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

// Customer-facing "Mark as paid". We have no payment gateway yet, so this simply
// records the full outstanding balance as a payment and flips the invoice to
// paid. One-way for now (no un-marking). Portal customers are SELECT-only on
// invoices/payments and record_wholesale_payment isn't SECURITY DEFINER, so we
// verify ownership with the user's session here, then write via the service
// client.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id, name')
    .eq('portal_user_id', user.id)
    .single()
  if (!customer) return NextResponse.json({ error: 'No wholesale account linked to this login' }, { status: 403 })

  // RLS also scopes this to the customer's own invoices; the explicit filter is belt-and-braces.
  const { data: inv } = await supabase
    .from('wholesale_invoices')
    .select('id, invoice_number, total_amount, amount_paid, payment_status')
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single()
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (inv.payment_status === 'paid') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 409 })

  const balance = inv.total_amount - inv.amount_paid
  if (balance <= 0) return NextResponse.json({ error: 'Nothing left to pay on this invoice' }, { status: 409 })

  const admin = createServiceClient()
  const { error } = await admin.rpc('record_wholesale_payment', {
    p_invoice_id: id,
    p_amount:     balance,
    p_date:       new Date().toISOString().split('T')[0],
    p_method:     'other',
    p_reference:  null,
    p_notes:      'Marked paid by customer via portal',
    p_user_id:    user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  sendTelegram(
    `💷 <b>Invoice marked paid — ${customer.name}</b>\n${inv.invoice_number} · ${pence(balance)}\n<i>Customer marked this as paid in the portal.</i>`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
