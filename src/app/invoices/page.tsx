import { NavBar } from '@/components/ui/NavBar'
import Link from 'next/link'
import { InvoicesClient } from './InvoicesClient'
import { createClient } from '@/lib/supabase/server'

export interface PendingInvoice {
  id: string
  supplier_name: string
  invoice_date: string
  created_at: string
}

export interface ConfirmedInvoice {
  id: string
  supplier_name: string
  invoice_date: string
  status: string
  item_count: number
}

export default async function InvoicesPage() {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('purchase_invoices')
    .select('id, supplier_name, invoice_date, created_at')
    .eq('status', 'uploaded')
    .order('created_at', { ascending: false })

  const { data: confirmedRaw } = await supabase
    .from('purchase_invoices')
    .select('id, supplier_name, invoice_date, status')
    .in('status', ['confirmed', 'processed'])
    .order('invoice_date', { ascending: false })
    .limit(60)

  // Get item counts in a second pass (avoids complex aggregate query)
  const confirmedIds = (confirmedRaw ?? []).map(i => i.id)
  const { data: itemCounts } = confirmedIds.length
    ? await supabase
        .from('purchase_invoice_items')
        .select('invoice_id')
        .in('invoice_id', confirmedIds)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const row of itemCounts ?? []) {
    countMap.set(row.invoice_id, (countMap.get(row.invoice_id) ?? 0) + 1)
  }

  const confirmed: ConfirmedInvoice[] = (confirmedRaw ?? []).map(i => ({
    ...i,
    item_count: countMap.get(i.id) ?? 0,
  }))

  const pendingInvoices: PendingInvoice[] = pending ?? []

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Upload
        </Link>
      </div>

      {pendingInvoices.length > 0 && (
        <div className="mb-6">
          <p className="section-title text-status-amber">Needs confirming</p>
          <div className="space-y-2">
            {pendingInvoices.map(inv => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}/review`}
                className="card flex items-center justify-between border border-status-amber/30
                           min-h-[64px] active:scale-[0.99] transition-transform"
              >
                <div>
                  <p className="font-semibold text-sm">{inv.supplier_name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(inv.invoice_date).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <span className="text-status-amber font-bold ml-4">Review →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <InvoicesClient confirmed={confirmed} />
      <NavBar />
    </div>
  )
}
