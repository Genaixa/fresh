import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.rpc('mark_overdue_invoices')

  const { data: customers } = await supabase
    .from('wholesale_customers')
    .select('*')
    .order('name')

  // Get balances per customer
  const { data: invoiceSums } = await supabase
    .from('wholesale_invoices')
    .select('customer_id, total_amount, amount_paid, payment_status')

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/wholesale" className="text-[var(--text-muted)]">←</Link>
          <h1 className="text-xl font-bold">Customers</h1>
        </div>
        <Link href="/wholesale/customers/new" className="btn-primary text-sm px-4 py-2">
          + Add
        </Link>
      </div>

      {(!customers || customers.length === 0) ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-muted)] mb-4">No customers yet</p>
          <Link href="/wholesale/customers/new" className="btn-primary px-6 py-3">
            Add first customer
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => {
            const cinv = (invoiceSums ?? []).filter(i => i.customer_id === c.id)
            const total   = cinv.reduce((s, i) => s + i.total_amount, 0)
            const paid    = cinv.reduce((s, i) => s + i.amount_paid, 0)
            const balance = total - paid
            const overdue = cinv
              .filter(i => i.payment_status === 'overdue')
              .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

            return (
              <Link key={c.id} href={`/wholesale/customers/${c.id}`}>
                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      {c.contact_name && (
                        <p className="text-[var(--text-muted)] text-xs">{c.contact_name}</p>
                      )}
                      {c.email && (
                        <p className="text-[var(--text-muted)] text-xs">{c.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {balance > 0 ? (
                        <>
                          <p className="font-bold text-yellow-400">{pence(balance)}</p>
                          <p className="text-[var(--text-muted)] text-xs">due</p>
                          {overdue > 0 && (
                            <p className="text-red-400 text-xs">{pence(overdue)} overdue</p>
                          )}
                        </>
                      ) : (
                        <p className="text-green-400 text-sm font-medium">All paid</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <NavBar />
    </div>
  )
}
