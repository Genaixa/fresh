import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateInvoiceFromOrder } from '@/lib/wholesale'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const invoice = await generateInvoiceFromOrder(id)
    return NextResponse.json({ invoice_id: invoice.id, invoice_number: invoice.invoice_number })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
