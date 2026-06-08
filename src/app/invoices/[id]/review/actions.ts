'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateSuggestedPrice, getWeightedAvgCostBatch } from '@/lib/pricing-engine'
import { fuzzyMatchProduct, saveMapping } from '@/lib/invoice-parser'
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

  // Get all matched items for this invoice
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('product_id, unit_cost, units_per_case, original_quoted_price, negotiated_price')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)
    .not('product_id', 'is', null)

  if (!items || items.length === 0) {
    redirect(`/invoices/${invoiceId}`)
  }

  // Update case_size from invoice where available
  for (const item of items) {
    if (item.units_per_case && item.units_per_case > 1) {
      await supabase
        .from('products')
        .update({ case_size: item.units_per_case })
        .eq('id', item.product_id)
    }
  }

  // Deduplicate product IDs (multiple invoice lines can map to the same product)
  const productIds = [...new Set(
    items.map(i => i.product_id).filter((id): id is string => id !== null)
  )]

  if (productIds.length === 0) redirect('/pricing')

  // Calculate weighted average cost for each product (last 7 days across all suppliers)
  const weightedCosts = await getWeightedAvgCostBatch(supabase, productIds)

  // Update purchase_cost on the product to reflect the weighted average
  // (used as display value and fallback if weighted view has no data yet)
  for (const [productId, cost] of weightedCosts) {
    await supabase
      .from('products')
      .update({ purchase_cost: cost })
      .eq('id', productId)
  }

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
    // Use the freshly-calculated weighted avg; fall back to the product's current purchase_cost
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

  // Only generate suggestions where there is actually a problem
  const changingSuggestions = suggestions.filter(s => {
    const cost = weightedCosts.get(s.product_id) ?? 0

    // Never suggest at or below cost
    if (s.suggested_retail_price <= cost) return false

    const product = (products as Product[]).find(p => p.id === s.product_id)
    const floor = product?.margin_floor ?? 0.20
    const ceiling = product?.market_ceiling ?? null

    const isUnpriced    = s.current_retail_price === 0
    const currentMargin = s.current_retail_price > 0
      ? (s.current_retail_price - cost) / s.current_retail_price
      : -1
    const isBelowFloor   = currentMargin < floor
    const isAboveCeiling = ceiling !== null && s.current_retail_price > ceiling

    return isUnpriced || isBelowFloor || isAboveCeiling
  })

  if (changingSuggestions.length > 0) {
    // Remove any existing pending suggestions for these products before inserting
    await supabase
      .from('price_suggestions')
      .delete()
      .eq('status', 'pending')
      .in('product_id', changingSuggestions.map(s => s.product_id))

    const { error: insertErr } = await supabase
      .from('price_suggestions')
      .insert(changingSuggestions)
    if (insertErr) console.error('Price suggestions insert error:', insertErr)
  }

  redirect('/pricing')
}
