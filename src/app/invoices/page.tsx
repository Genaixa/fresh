import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import type { PurchaseInvoice } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  uploaded:   '📤 Uploaded',
  processing: '⏳ Processing',
  processed:  '✓ Done',
  error:      '⚠ Error',
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('purchase_invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .limit(30)

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Upload
        </Link>
      </div>

      <div className="space-y-2">
        {(invoices ?? []).map((inv: PurchaseInvoice) => (
          <Link
            key={inv.id}
            href={`/invoices/${inv.id}`}
            className="card flex items-center justify-between min-h-[56px]
                       active:scale-[0.99] transition-transform"
          >
            <div>
              <p className="font-medium">{inv.supplier_name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
              </p>
            </div>
            <span className="text-sm">{STATUS_LABEL[inv.status] ?? inv.status}</span>
          </Link>
        ))}

        {(invoices ?? []).length === 0 && (
          <p className="text-center text-[var(--text-muted)] py-12">
            No invoices yet. Upload one to get started.
          </p>
        )}
      </div>

      <NavBar />
    </div>
  )
}
