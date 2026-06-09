import { createClient } from '@/lib/supabase/server'
import { upsertProduct, deactivateProduct } from '../actions'
import Link from 'next/link'
import { calculateSuggestedPrice, formatPrice, formatMargin } from '@/lib/pricing-engine'
import type { Product } from '@/types'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const isNew = id === 'new'

  const supabase = await createClient()
  let product: Product | null = null

  if (!isNew) {
    const { data } = await supabase.from('products').select('*').eq('id', id).single()
    product = data
  }

  const suggestion = product ? calculateSuggestedPrice(product) : null

  const defaults = {
    name: '',
    category: 'fruit',
    unit: 'each',
    retail_price: 0,
    wholesale_price: 0,
    purchase_cost: 0,
    price_multiplier: 2.0,
    market_ceiling: '',
    margin_floor: 20,
    epos_now_id: '',
  }
  const p = product
    ? {
        ...product,
        retail_price:    (product.retail_price   / 100).toFixed(2),
        wholesale_price: (product.wholesale_price / 100).toFixed(2),
        purchase_cost:   (product.purchase_cost   / 100).toFixed(2),
        market_ceiling:  product.market_ceiling ? (product.market_ceiling / 100).toFixed(2) : '',
        margin_floor:    product.margin_floor * 100,
      }
    : defaults

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-brand-accent min-h-[48px] min-w-[48px]
                                          flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">{isNew ? 'New Product' : product?.name}</h1>
      </div>

      {/* Margin warning banner */}
      {suggestion?.margin_warning && (
        <div className="mb-4 rounded-xl bg-status-amber/10 border border-status-amber/30
                        px-4 py-3 text-sm text-status-amber">
          ⚠️ Ceiling ({formatPrice(product!.market_ceiling!)}) prevents {formatMargin(product!.margin_floor)} margin
          at current cost ({formatPrice(product!.purchase_cost)}). Actual: {formatMargin(suggestion.margin_percentage)}
        </div>
      )}

      <form className="space-y-4">
        {product && <input type="hidden" name="id" value={product.id} />}

        <Field label="Product name">
          <input name="name" defaultValue={p.name} required
            className="input-field" placeholder="e.g. Lemon" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select name="category" defaultValue={p.category} className="input-field">
              <option value="fruit">Fruit</option>
              <option value="veg">Veg</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue={p.unit} className="input-field">
              {['each', 'kg', 'box', 'punnet', 'bunch', 'bag'].map(u => (
                <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Retail price (£)">
            <input name="retail_price" type="number" min="0" step="0.01"
              defaultValue={p.retail_price} className="input-field" />
          </Field>
          <Field label="Wholesale price (£)">
            <input name="wholesale_price" type="number" min="0" step="0.01"
              defaultValue={p.wholesale_price} className="input-field" />
          </Field>
        </div>

        <Field label="Purchase cost (£)">
          <input name="purchase_cost" type="number" min="0" step="0.01"
            defaultValue={p.purchase_cost} className="input-field" />
        </Field>

        <div className="border-t border-white/10 pt-4">
          <p className="section-title">Pricing Engine</p>
          <div className="space-y-3">
            <Field label="Multiplier (e.g. 2.0 = cost × 2)">
              <input name="price_multiplier" type="number" step="0.05" min="1"
                defaultValue={p.price_multiplier} className="input-field" />
            </Field>
            <Field label="Market ceiling (£) — leave blank for none">
              <input name="market_ceiling" type="number" min="0" step="0.01"
                defaultValue={p.market_ceiling} className="input-field" placeholder="No ceiling" />
            </Field>
            <Field label="Margin floor (%)">
              <input name="margin_floor" type="number" step="1" min="0" max="100"
                defaultValue={p.margin_floor} className="input-field" />
            </Field>
          </div>
        </div>

        <Field label="EPOS Now ID (optional)">
          <input name="epos_now_id" defaultValue={p.epos_now_id ?? ''}
            className="input-field" placeholder="Leave blank if not synced" />
        </Field>

        <button formAction={upsertProduct} className="btn-primary w-full mt-2">
          {isNew ? 'Create Product' : 'Save Changes'}
        </button>

        {!isNew && (
          <form action={deactivateProduct.bind(null, id)}>
            <button className="btn-danger w-full">Deactivate Product</button>
          </form>
        )}
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  )
}
