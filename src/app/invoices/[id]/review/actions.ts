'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateSuggestedPrice } from '@/lib/pricing-engine'
import type { Product } from '@/types'

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

  // Re-fetch updated products and generate price suggestions
  const productIds = items.map(i => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)

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
    await supabase.from('price_suggestions').insert(changingSuggestions)
  }

  redirect('/pricing')
}
