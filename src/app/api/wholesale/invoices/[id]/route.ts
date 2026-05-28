import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  await supabase.rpc('mark_overdue_invoices')

  const { data, error } = await supabase
    .from('wholesale_invoices')
    .select(`
      *,
      customer:wholesale_customers(*),
      items:wholesale_invoice_items(*),
      payments:wholesale_payments(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
