'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateSuggestedPrice, } from '@/lib/pricing-engine'
import { fuzzyMatchProduct } from '@/lib/invoice-parser'
import type { Product } from '@/types'

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

  const { data: catalogue } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)

  let matchCount = 0
  for (const item of items) {
    const product_id = fuzzyMatchProduct(item.product_name_raw, catalogue ?? [])
    if (product_id) {
      await supabase
        .from('purchase_invoice_items')
        .update({ product_id, is_matched: true })
        .eq('id', item.id)
      matchCount++
    }
  }

  revalidatePath(`/invoices/${invoiceId}/review`)
}

export async function confirmInvoiceAndGeneratePrices(invoiceId: string) {
  const supabase = await createClient()

  // Get all matched items for this invoice
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, original_quoted_price, negotiated_price')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) {
    redirect(`/invoices/${invoiceId}`)
  }

  // Update each product's purchase_cost with the new invoice price
  // Business rule: use negotiated_price if set, otherwise unit_cost
  for (const item of items) {
    const new_cost = item.negotiated_price ?? item.unit_cost
    await supabase
      .from('products')
      .update({ purchase_cost: new_cost })
      .eq('id', item.product_id)
  }

  // Deduplicate product IDs (multiple invoice lines can map to the same product)
  const productIds = [...new Set(
    items.map(i => i.product_id).filter((id): id is string => id !== null)
  )]

  if (productIds.length === 0) redirect('/pricing')

  // Re-fetch updated products and generate price suggestions
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)

  if (prodErr || !products || products.length === 0) {
    console.error('Failed to fetch products for suggestions:', prodErr)
    redirect('/pricing')
  }

  const suggestions = (products as Product[]).map(product => {
    const result = calculateSuggestedPrice(product)
    return {
      product_id:             product.id,
      invoice_id:             invoiceId,
      current_retail_price:   product.retail_price,
      suggested_retail_price: result.suggested_price,
      rule_applied:           result.rule_applied,
      margin_percentage:      result.margin_percentage,
      margin_warning:         result.margin_warning,
      status:                 'pending' as const,
    }
  })

  // Only insert suggestions where price actually changes
  const changingSuggestions = suggestions.filter(
    s => s.suggested_retail_price !== s.current_retail_price
  )

  if (changingSuggestions.length > 0) {
    const { error: insertErr } = await supabase
      .from('price_suggestions')
      .insert(changingSuggestions)
    if (insertErr) console.error('Price suggestions insert error:', insertErr)
  }

  redirect('/pricing')
}
