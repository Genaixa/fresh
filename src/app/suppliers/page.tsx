import { createClient } from '@/lib/supabase/server'
import { upsertSupplier, toggleSupplierActive } from './actions'
import type { Supplier } from '@/types'

export default async function SuppliersPage() {
  const supabase = await createClient()

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('market_order', { ascending: true, nullsFirst: false })

  const list = (suppliers ?? []) as Supplier[]
  const active   = list.filter(s => s.is_active)
  const inactive = list.filter(s => !s.is_active)

  return (
    <div className="page pb-24">
      <h1 className="text-xl font-bold mb-6">Suppliers</h1>

      {/* Add new */}
      <details className="card mb-6">
        <summary className="font-semibold cursor-pointer select-none min-h-[44px] flex items-center">
          + Add supplier
        </summary>
        <form action={upsertSupplier} className="mt-4 space-y-3">
          <input type="hidden" name="is_active" value="true" />
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="e.g. Smith's Greens" />
          </div>
          <div>
            <label className="label">Market order <span className="text-[var(--text-muted)] font-normal">(walking sequence)</span></label>
            <input name="market_order" type="number" min="1" className="input" placeholder="e.g. 3" />
          </div>
          <button type="submit" className="btn-primary w-full">Save supplier</button>
        </form>
      </details>

      {/* Active suppliers */}
      <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
        Active ({active.length})
      </h2>
      <div className="space-y-3 mb-8">
        {active.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm">No active suppliers yet.</p>
        )}
        {active.map(s => (
          <SupplierCard key={s.id} supplier={s} />
        ))}
      </div>

      {/* Inactive suppliers */}
      {inactive.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Inactive ({inactive.length})
          </h2>
          <div className="space-y-3">
            {inactive.map(s => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </div>
        </>
      )}

    </div>
  )
}

function SupplierCard({ supplier: s }: { supplier: Supplier }) {
  return (
    <details className="card">
      <summary className="flex items-center justify-between cursor-pointer select-none min-h-[44px]">
        <div className="flex items-center gap-3">
          {s.market_order != null && (
            <span className="text-xs bg-white/10 rounded px-2 py-0.5 font-mono">
              #{s.market_order}
            </span>
          )}
          <span className="font-medium">{s.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          s.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-[var(--text-muted)]'
        }`}>
          {s.is_active ? 'Active' : 'Inactive'}
        </span>
      </summary>

      {/* Edit form */}
      <form action={upsertSupplier} className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="is_active" value={s.is_active ? 'true' : 'false'} />
        <div>
          <label className="label">Name</label>
          <input name="name" required defaultValue={s.name} className="input" />
        </div>
        <div>
          <label className="label">Market order</label>
          <input
            name="market_order"
            type="number"
            min="1"
            defaultValue={s.market_order ?? ''}
            className="input"
            placeholder="—"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">Save</button>
          <form action={toggleSupplierActive.bind(null, s.id, !s.is_active)}>
            <button
              type="submit"
              className="btn-secondary px-4 min-h-[48px]"
            >
              {s.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </form>
        </div>
      </form>
    </details>
  )
}
