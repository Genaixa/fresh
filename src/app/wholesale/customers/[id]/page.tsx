import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

const STATUS_STYLE: Record<string, string> = {
  paid:     'bg-green-900 text-green-300',
  partial:  'bg-yellow-900 text-yellow-300',
  overdue:  'bg-red-900 text-red-300',
  unpaid:   'bg-zinc-700 text-zinc-300',
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.rpc('mark_overdue_invoices')

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('*')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  const { data: invoices } = await supabase
    .from('wholesale_invoices')
    .select('*')
    .eq('customer_id', id)
    .order('invoice_date', { ascending: false })

  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('*, items:wholesale_order_items(count)')
    .eq('customer_id', id)
    .order('order_date', { ascending: false })
    .limit(10)

  const total_invoiced = (invoices ?? []).reduce((s, i) => s + i.total_amount, 0)
  const total_paid     = (invoices ?? []).reduce((s, i) => s + i.amount_paid, 0)
  const balance_due    = total_invoiced - total_paid
  const overdue        = (invoices ?? [])
    .filter(i => i.payment_status === 'overdue')
    .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wholesale/customers" className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">{customer.name}</h1>
      </div>

      {/* Contact info */}
      <div className="card mb-4 space-y-1 text-sm">
        {customer.contact_name && <p>{customer.contact_name}</p>}
        {customer.email && (
          <p><a href={`mailto:${customer.email}`} className="text-brand-accent">{customer.email}</a></p>
        )}
        {customer.phone && (
          <p><a href={`tel:${customer.phone}`} className="text-brand-accent">{customer.phone}</a></p>
        )}
        {customer.address && <p className="text-[var(--text-muted)]">{customer.address}</p>}
        <p className="text-[var(--text-muted)]">Payment terms: {customer.payment_terms} days</p>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="card text-center py-3">
          <p className="text-[var(--text-muted)] text-xs">Invoiced</p>
          <p className="font-bold text-sm">{pence(total_invoiced)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-[var(--text-muted)] text-xs">Paid</p>
          <p className="font-bold text-sm text-green-400">{pence(total_paid)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-[var(--text-muted)] text-xs">{overdue > 0 ? 'Overdue' : 'Balance'}</p>
          <p className={`font-bold text-sm ${overdue > 0 ? 'text-red-400' : balance_due > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {pence(overdue > 0 ? overdue : balance_due)}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        <Link href={`/wholesale/orders/new?customer=${id}`} className="btn-primary flex-1 text-center py-3 text-sm">
          + New Order
        </Link>
      </div>

      {/* Invoices */}
      <section className="mb-6">
        <h2 className="font-semibold mb-3">Invoices</h2>
        {(!invoices || invoices.length === 0) ? (
          <p className="text-[var(--text-muted)] text-sm">No invoices yet</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <Link key={inv.id} href={`/wholesale/invoices/${inv.id}`}>
                <div className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-[var(--text-muted)] text-xs">
                      {new Date(inv.invoice_date).toLocaleDateString('en-GB')} · due {new Date(inv.due_date).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{pence(inv.total_amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[inv.payment_status] ?? ''}`}>
                      {inv.payment_status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent orders */}
      {(orders?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Orders</h2>
          <div className="space-y-2">
            {orders!.map(o => (
              <Link key={o.id} href={`/wholesale/orders/${o.id}`}>
                <div className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm">{new Date(o.order_date).toLocaleDateString('en-GB')}</p>
                    {o.delivery_date && (
                      <p className="text-[var(--text-muted)] text-xs">
                        Delivery: {new Date(o.delivery_date).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium
                    ${o.status === 'dispatched' ? 'bg-green-900 text-green-300'
                    : o.status === 'confirmed'  ? 'bg-blue-900 text-blue-300'
                    : o.status === 'cancelled'  ? 'bg-red-900 text-red-300'
                    : 'bg-zinc-700 text-zinc-300'}`}>
                    {o.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
