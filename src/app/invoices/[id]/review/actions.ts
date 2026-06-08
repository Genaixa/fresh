'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateSuggestedPrice, getWeightedAvgCostBatch } from '@/lib/pricing-engine'
import { fuzzyMatchProduct, saveMapping } from '@/lib/invoice-parser'
import { autoConfirmInvoice } from '@/lib/confirm-invoice'
import type { Product } from '@/types'

export async function saveInvoiceNumber(invoiceId: string, formData: FormData) {
  const number = (formData.get('invoice_number') as string ?? '').trim()
  const supabase = await createClient()
  await supabase.from('purchase_invoices').update({ invoice_number: number || null }).eq('id', invoiceId)
  revalidatePath(`/invoices/${invoiceId}/review`)
}

export async function rematchInvoiceItems(invoiceId: string) {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('id, product_name_raw')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', false)

  if (!items || items.length === 0) {
    revalidatePath(`/invoices/${invoiceId}/review`)
    return
  }

  // Get the supplier name for this invoice (needed to save mappings)
  const { data: invoice } = await supabase
    .from('purchase_invoices')
    .select('supplier_name')
    .eq('id', invoiceId)
    .single()

  const { data: catalogue } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)

  for (const item of items) {
    const product_id = fuzzyMatchProduct(item.product_name_raw, catalogue ?? [])
    if (product_id) {
      await supabase
        .from('purchase_invoice_items')
        .update({ product_id, is_matched: true })
        .eq('id', item.id)
      // Save auto-match so next invoice skips fuzzy matching
      if (invoice?.supplier_name) {
        await saveMapping(supabase, invoice.supplier_name, item.product_name_raw, product_id, null)
      }
    }
  }

  revalidatePath(`/invoices/${invoiceId}/review`)
}

export async function confirmInvoiceAndGeneratePrices(invoiceId: string) {
  const supabase = await createClient()
  await autoConfirmInvoice(supabase as Parameters<typeof autoConfirmInvoice>[0], invoiceId)
  redirect('/pricing')
}
