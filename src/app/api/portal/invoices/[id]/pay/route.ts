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

  // Read for an early, friendly 404/409 and to label the Telegram ping. The RPC
  // below is the authoritative, race-safe guard — this read is not relied on for
  // correctness. RLS also scopes this to the customer's own invoices.
  const { data: inv } = await supabase
    .from('wholesale_invoices')
    .select('invoice_number, payment_status')
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single()
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (inv.payment_status === 'paid') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 409 })

  // Atomic: locks the invoice row, re-checks ownership + paid status, records the
  // full balance, flips to paid — all in one transaction. Concurrent double-taps
  // serialize, so the second tap gets "already paid" instead of double-paying.
  const admin = createServiceClient()
  const { data: paid, error } = await admin.rpc('pay_wholesale_invoice_full', {
    p_invoice_id:  id,
    p_customer_id: customer.id,
    p_user_id:     user.id,
    p_notes:       'Marked paid by customer via portal',
  })
  if (error) {
    if (error.code === 'P0001') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 409 })
    if (error.code === 'P0002') return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (error.code === 'P0003') return NextResponse.json({ error: 'Nothing left to pay on this invoice' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  sendTelegram(
    `💷 <b>Invoice marked paid — ${customer.name}</b>\n${inv.invoice_number} · ${pence(paid as number)}\n<i>Customer marked this as paid in the portal.</i>`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
