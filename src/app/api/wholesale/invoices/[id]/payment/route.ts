import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount_pence, payment_date, method, reference, notes } = body

  if (!amount_pence || amount_pence <= 0) {
    return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
  }

  const { error } = await supabase.rpc('record_wholesale_payment', {
    p_invoice_id: id,
    p_amount:     amount_pence,
    p_date:       payment_date ?? new Date().toISOString().split('T')[0],
    p_method:     method ?? 'bank_transfer',
    p_reference:  reference ?? null,
    p_notes:      notes ?? null,
    p_user_id:    user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
