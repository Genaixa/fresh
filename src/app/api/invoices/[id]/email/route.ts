import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInvoiceEmail } from '@/lib/email'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { to } = await sendInvoiceEmail(id)
    return NextResponse.json({ ok: true, to })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
