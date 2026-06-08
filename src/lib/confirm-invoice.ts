import { calculateSuggestedPrice, getWeightedAvgCostBatch } from './pricing-engine'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from '@/types'

export async function autoConfirmInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, units_per_case')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return
  }

  // Update case_size from invoice where available
  for (const item of items) {
    if (item.units_per_case && item.units_per_case > 1) {
      await supabase.from('products').update({ case_size: item.units_per_case }).eq('id', item.product_id)
    }
  }

  const productIds = [...new Set(
    items.map(i => i.product_id).filter((id): id is string => id !== null)
  )]

  const weightedCosts = await getWeightedAvgCostBatch(supabase, productIds)

  for (const [productId, cost] of weightedCosts) {
    await supabase.from('products').update({ purchase_cost: cost }).eq('id', productId)
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)

  if (!products || products.length === 0) {
    await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
    return
  }

  const suggestions = (products as Product[]).map(product => {
    const weightedCost = weightedCosts.get(product.id) ?? undefined
    const result = calculateSuggestedPrice(product, weightedCost)
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

  const changingSuggestions = suggestions.filter(s => {
    const cost = weightedCosts.get(s.product_id) ?? 0
    if (s.suggested_retail_price <= cost) return false
    const product = (products as Product[]).find(p => p.id === s.product_id)
    const floor   = product?.margin_floor ?? 0.20
    const ceiling = product?.market_ceiling ?? null
    const isUnpriced    = s.current_retail_price === 0
    const currentMargin = s.current_retail_price > 0
      ? (s.current_retail_price - cost) / s.current_retail_price : -1
    return isUnpriced || currentMargin < floor || (ceiling !== null && s.current_retail_price > ceiling)
  })

  if (changingSuggestions.length > 0) {
    await supabase
      .from('price_suggestions')
      .delete()
      .eq('status', 'pending')
      .in('product_id', changingSuggestions.map(s => s.product_id))
    await supabase.from('price_suggestions').insert(changingSuggestions)
  }

  await supabase.from('purchase_invoices').update({ status: 'processed' }).eq('id', invoiceId)
}
