import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { getCustomerBalances } from '@/lib/wholesale'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function pence(p: number) {
  return `£${(p / 100).toFixed(2)}`
}

export default async function WholesalePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const balances = await getCustomerBalances()

  const totalOutstanding = balances.reduce((s, b) => s + b.balance_due, 0)
  const totalOverdue     = balances.reduce((s, b) => s + b.overdue_amount, 0)

  // Recent invoices
  const { data: recentInvoices } = await supabase
    .from('wholesale_invoices')
    .select('*, customer:wholesale_customers(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Open orders (draft + confirmed)
  const { data: openOrders } = await supabase
    .from('wholesale_orders')
    .select('*, customer:wholesale_customers(name)')
    .in('status', ['draft', 'confirmed'])
    .order('order_date', { ascending: false })
    .limit(5)

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Wholesale</h1>
        <Link href="/wholesale/orders/new" className="btn-primary text-sm px-4 py-2">
          + New Order
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-[var(--text-muted)] text-xs mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {pence(totalOutstanding)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-[var(--text-muted)] text-xs mb-1">Overdue</p>
          <p className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {pence(totalOverdue)}
          </p>
        </div>
      </div>

      {/* Customer balances */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Customers</h2>
          <Link href="/wholesale/customers" className="text-brand-accent text-sm">See all</Link>
        </div>
        {balances.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-[var(--text-muted)] mb-3">No customers yet</p>
            <Link href="/wholesale/customers/new" className="btn-primary text-sm px-4 py-2">
              Add first customer
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map(b => (
              <Link key={b.customer.id} href={`/wholesale/customers/${b.customer.id}`}>
                <div className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.customer.name}</p>
                    {b.overdue_amount > 0 && (
                      <p className="text-red-400 text-xs">{pence(b.overdue_amount)} overdue</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${b.balance_due > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {pence(b.balance_due)}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs">due</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Open orders */}
      {(openOrders?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Open Orders</h2>
          <div className="space-y-2">
            {openOrders!.map(o => (
              <Link key={o.id} href={`/wholesale/orders/${o.id}`}>
                <div className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium">{(o.customer as any)?.name}</p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {new Date(o.order_date).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${o.status === 'confirmed' ? 'bg-green-900 text-green-300' : 'bg-zinc-700 text-zinc-300'}`}>
                    {o.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent invoices */}
      {(recentInvoices?.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Invoices</h2>
            <Link href="/wholesale/invoices" className="text-brand-accent text-sm">See all</Link>
          </div>
          <div className="space-y-2">
            {recentInvoices!.map(inv => (
              <Link key={inv.id} href={`/wholesale/invoices/${inv.id}`}>
                <div className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-[var(--text-muted)] text-xs">{(inv.customer as any)?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{pence(inv.total_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${inv.payment_status === 'paid'    ? 'bg-green-900 text-green-300'
                      : inv.payment_status === 'overdue' ? 'bg-red-900 text-red-300'
                      : inv.payment_status === 'partial' ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-zinc-700 text-zinc-300'}`}>
                      {inv.payment_status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <NavBar />
    </div>
  )
}
