import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function InvoicesPage() {
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('id, supplier_name, invoice_date, status')
    // NB: status is the invoice_status enum (uploaded|processing|processed|error) —
    // a non-label value here makes Postgres reject the whole query and the page
    // silently renders empty.
    .in('status', ['uploaded', 'processing', 'processed'])
    .order('invoice_date', { ascending: false })
    .limit(60)

  const ids = (invoices ?? []).map(i => i.id)

  const { data: itemRows } = ids.length
    ? await supabase
        .from('purchase_invoice_items')
        .select('invoice_id, is_matched')
        .in('invoice_id', ids)
    : { data: [] }

  const stats = new Map<string, { total: number; unmatched: number }>()
  for (const row of itemRows ?? []) {
    const s = stats.get(row.invoice_id) ?? { total: 0, unmatched: 0 }
    s.total++
    if (!row.is_matched) s.unmatched++
    stats.set(row.invoice_id, s)
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <Link href="/dashboard" aria-label="Back to home"
                className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl">←</Link>
          <h1 className="text-xl font-bold">Invoices</h1>
        </div>
        <Link href="/invoices/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Upload
        </Link>
      </div>

      <div className="space-y-2">
        {(invoices ?? []).map(inv => {
          const s = stats.get(inv.id)
          const hasUnmatched = (s?.unmatched ?? 0) > 0
          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}/review`}
              className="card flex items-center justify-between min-h-[64px] active:scale-[0.99] transition-transform"
            >
              <div>
                <p className="font-semibold text-sm">{inv.supplier_name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {new Date(inv.invoice_date).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                  {s && <span className="ml-2 opacity-60">· {s.total} items</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {hasUnmatched && (
                  <span className="text-xs bg-status-amber/15 text-status-amber px-2 py-0.5 rounded-full">
                    {s!.unmatched} unmatched
                  </span>
                )}
                <span className="text-[var(--text-muted)] font-bold">→</span>
              </div>
            </Link>
          )
        })}
      </div>

    </div>
  )
}
