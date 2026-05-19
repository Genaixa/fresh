import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const form = await request.formData()
  const product_id = form.get('product_id') as string | null

  if (!product_id) {
    // Skip — just redirect back without mapping
    const referer = request.headers.get('referer') ?? '/invoices'
    return NextResponse.redirect(new URL(referer, request.url))
  }

  await supabase
    .from('purchase_invoice_items')
    .update({ product_id, is_matched: true })
    .eq('id', id)

  const referer = request.headers.get('referer') ?? '/invoices'
  return NextResponse.redirect(new URL(referer, request.url))
}
