import { upsertProduct } from '../actions'
import Link from 'next/link'

export default function NewProductPage() {
  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-brand-accent min-h-[48px] min-w-[48px]
                                          flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">New Product</h1>
      </div>

      <form className="space-y-4">
        <Field label="Product name">
          <input name="name" required className="input-field" placeholder="e.g. Lemon" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select name="category" defaultValue="fruit" className="input-field">
              <option value="fruit">Fruit</option>
              <option value="veg">Veg</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue="each" className="input-field">
              {['each', 'kg', 'box', 'punnet', 'bunch', 'bag'].map(u => (
                <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Retail price (p)">
            <input name="retail_price" type="number" min="0" defaultValue={0} className="input-field" />
          </Field>
          <Field label="Wholesale price (p)">
            <input name="wholesale_price" type="number" min="0" defaultValue={0} className="input-field" />
          </Field>
        </div>

        <Field label="Purchase cost (p)">
          <input name="purchase_cost" type="number" min="0" defaultValue={0} className="input-field" />
        </Field>

        <div className="border-t border-white/10 pt-4">
          <p className="section-title">Pricing Engine</p>
          <div className="space-y-3">
            <Field label="Multiplier (e.g. 2.0 = cost × 2)">
              <input name="price_multiplier" type="number" step="0.05" min="1"
                defaultValue={2.0} className="input-field" />
            </Field>
            <Field label="Market ceiling (p) — leave blank for none">
              <input name="market_ceiling" type="number" min="0"
                className="input-field" placeholder="No ceiling" />
            </Field>
            <Field label="Margin floor (%)">
              <input name="margin_floor" type="number" step="1" min="0" max="100"
                defaultValue={20} className="input-field" />
            </Field>
          </div>
        </div>

        <Field label="EPOS Now ID (optional)">
          <input name="epos_now_id" className="input-field" placeholder="Leave blank if not synced" />
        </Field>

        <button formAction={upsertProduct} className="btn-primary w-full mt-2">
          Create Product
        </button>
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
