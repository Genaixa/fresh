import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveMapping } from '@/lib/invoice-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const form = await request.formData()
  const product_id = form.get('product_id') as string | null

  if (!product_id) {
    const referer = request.headers.get('referer') ?? '/invoices'
    return NextResponse.redirect(new URL(referer, request.url))
  }

  // Get the raw description and supplier name so we can save the mapping
  const { data: item } = await supabase
    .from('purchase_invoice_items')
    .select('product_name_raw, invoice:purchase_invoices(supplier_name)')
    .eq('id', id)
    .single()

  await supabase
    .from('purchase_invoice_items')
    .update({ product_id, is_matched: true })
    .eq('id', id)

  // Save as human-confirmed mapping so this description is instantly matched next time
  if (item?.product_name_raw) {
    const supplierName = (item.invoice as any)?.supplier_name ?? ''
    await saveMapping(supabase, supplierName, item.product_name_raw, product_id, user?.id ?? null)
  }

  const referer = request.headers.get('referer') ?? '/invoices'
  return NextResponse.redirect(new URL(referer, request.url))
}
