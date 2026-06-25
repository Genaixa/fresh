import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
      <div className="flex items-center gap-1 mb-6">
        <Link href="/dashboard" aria-label="Back to home"
              className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Suppliers</h1>
      </div>

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
          <ContactFields s={null} />
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

function ContactFields({ s }: { s: Supplier | null }) {
  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Contact</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Phone</label>
          <input name="phone" defaultValue={s?.phone ?? ''} className="input" placeholder="020 …" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={s?.email ?? ''} className="input" placeholder="orders@…" />
        </div>
      </div>
      <div>
        <label className="label">Address</label>
        <input name="address" defaultValue={s?.address ?? ''} className="input" placeholder="Street, town, postcode" />
      </div>
      <div>
        <label className="label">Payment ref <span className="text-[var(--text-muted)] font-normal">(bank / account)</span></label>
        <input name="account_ref" defaultValue={s?.account_ref ?? ''} className="input" placeholder="Sort code · account no" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea name="notes" defaultValue={s?.notes ?? ''} className="input" rows={2} placeholder="Delivery days, VAT status, invoice-number format…" />
      </div>
    </div>
  )
}

function ContactDisplay({ s }: { s: Supplier }) {
  const rows: [string, string | null, string | null][] = [
    ['Phone',   s.phone,   s.phone ? `tel:${s.phone.replace(/\s/g, '')}` : null],
    ['Email',   s.email,   s.email ? `mailto:${s.email}` : null],
    ['Address', s.address, null],
    ['Pay',     s.account_ref, null],
  ]
  const has = rows.some(([, v]) => v) || s.notes
  if (!has) {
    return <p className="mt-4 text-sm text-[var(--text-muted)] italic">No contact details yet — add them below.</p>
  }
  return (
    <dl className="mt-4 space-y-1 text-sm">
      {rows.filter(([, v]) => v).map(([label, v, href]) => (
        <div key={label} className="flex gap-2">
          <dt className="w-16 shrink-0 text-[var(--text-muted)]">{label}</dt>
          <dd className="font-medium break-all">
            {href ? <a href={href} className="text-[var(--accent,#60a5fa)] underline">{v}</a> : v}
          </dd>
        </div>
      ))}
      {s.notes && (
        <div className="flex gap-2 pt-1">
          <dt className="w-16 shrink-0 text-[var(--text-muted)]">Notes</dt>
          <dd className="text-[var(--text-muted)]">{s.notes}</dd>
        </div>
      )}
    </dl>
  )
}

function SupplierCard({ supplier: s }: { supplier: Supplier }) {
  return (
    <details className="card">
      <summary className="flex items-center justify-between cursor-pointer select-none min-h-[44px]">
        <div className="flex items-center gap-3">
          <span className="font-medium">{s.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          s.is_active ? 'bg-green-500/20 text-green-400' : 'bg-black/5 text-[var(--text-muted)]'
        }`}>
          {s.is_active ? 'Active' : 'Inactive'}
        </span>
      </summary>

      {/* Contact details (read) */}
      <ContactDisplay s={s} />

      {/* Edit form */}
      <form action={upsertSupplier} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
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
        <ContactFields s={s} />
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
