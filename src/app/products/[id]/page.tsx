import { createClient } from '@/lib/supabase/server'
import { deactivateProduct } from '../actions'
import Link from 'next/link'
import { calculateSuggestedPrice, formatPrice, formatMargin } from '@/lib/pricing-engine'
import { ProductForm } from '../ProductForm'
import type { Product } from '@/types'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: product }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).single(),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
  ])

  if (!product) return <div className="page">Product not found.</div>

  const suggestion = calculateSuggestedPrice(product)

  const defaultValues = {
    name:                product.name,
    category:            product.category,
    unit:                product.unit,
    retail_price:        (product.retail_price   / 100).toFixed(2),
    wholesale_price:     (product.wholesale_price / 100).toFixed(2),
    purchase_cost:       (product.purchase_cost   / 100).toFixed(2),
    case_size:           product.case_size ?? 1,
    price_multiplier:    product.price_multiplier ?? 2.0,
    market_ceiling:      product.market_ceiling ? (product.market_ceiling / 100).toFixed(2) : '',
    margin_floor:        (product.margin_floor ?? 0.2) * 100,
    epos_now_id:         product.epos_now_id ?? '',
    plu_code:            product.plu_code != null ? String(product.plu_code) : '',
    default_supplier_id: (product as Record<string, unknown>).default_supplier_id as string ?? '',
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-brand-accent min-h-[48px] min-w-[48px]
                                          flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">{product.name}</h1>
      </div>

      {suggestion?.margin_warning && (
        <div className="mb-4 rounded-xl bg-status-amber/10 border border-status-amber/30
                        px-4 py-3 text-sm text-status-amber">
          ⚠️ Ceiling ({formatPrice(product.market_ceiling!)}) prevents {formatMargin(product.margin_floor)} margin
          at current cost ({formatPrice(product.purchase_cost)}). Actual: {formatMargin(suggestion.margin_percentage)}
        </div>
      )}

      <ProductForm
        id={id}
        defaultValues={defaultValues}
        suppliers={suppliers ?? []}
        isNew={false}
        deactivateButton={
          <form action={deactivateProduct.bind(null, id)}>
            <button className="btn-danger w-full">Deactivate Product</button>
          </form>
        }
      />
    </div>
  )
}
