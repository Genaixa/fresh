import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

const STATUS_STYLE: Record<string, string> = {
  paid:     'bg-green-900 text-green-300',
  partial:  'bg-yellow-900 text-yellow-300',
  overdue:  'bg-red-900 text-red-300',
  unpaid:   'bg-zinc-700 text-zinc-300',
}

export default async function InvoicesListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.rpc('mark_overdue_invoices')

  const { data: invoices } = await supabase
    .from('wholesale_invoices')
    .select('*, customer:wholesale_customers(name)')
    .order('invoice_date', { ascending: false })

  const totalUnpaid = (invoices ?? [])
    .filter(i => i.payment_status !== 'paid')
    .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wholesale" className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">All Invoices</h1>
      </div>

      {totalUnpaid > 0 && (
        <div className="card mb-4 flex items-center justify-between">
          <p className="text-[var(--text-muted)] text-sm">Total outstanding</p>
          <p className="text-xl font-bold text-yellow-400">{pence(totalUnpaid)}</p>
        </div>
      )}

      {(!invoices || invoices.length === 0) ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-muted)]">No invoices yet</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">Dispatch an order to generate an invoice</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <Link key={inv.id} href={`/wholesale/invoices/${inv.id}`}>
              <div className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{inv.invoice_number}</p>
                  <p className="text-[var(--text-muted)] text-xs">{(inv.customer as any)?.name}</p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                    {' · due '}{new Date(inv.due_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{pence(inv.total_amount)}</p>
                  {inv.amount_paid > 0 && inv.payment_status !== 'paid' && (
                    <p className="text-green-400 text-xs">{pence(inv.amount_paid)} paid</p>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[inv.payment_status] ?? ''}`}>
                    {inv.payment_status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
