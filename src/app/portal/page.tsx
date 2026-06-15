import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/login/actions'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

const STATUS_STYLE: Record<string, string> = {
  paid:     'bg-green-900 text-green-300',
  partial:  'bg-yellow-900 text-yellow-300',
  overdue:  'bg-red-900 text-red-300',
  unpaid:   'bg-zinc-700 text-zinc-300',
}

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/portal')

  await supabase.rpc('mark_overdue_invoices')

  // Find their wholesale customer record
  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('*')
    .eq('portal_user_id', user.id)
    .single()

  if (!customer) {
    return (
      <div className="page text-center pt-20">
        <p className="text-[var(--text-muted)]">Your account is not linked to a wholesale customer.</p>
        <p className="text-[var(--text-muted)] text-sm mt-2">Please contact Fresh &amp; Fruity.</p>
      </div>
    )
  }

  const { data: invoices } = await supabase
    .from('wholesale_invoices')
    .select('*, items:wholesale_invoice_items(*), payments:wholesale_payments(*)')
    .eq('customer_id', customer.id)
    .order('invoice_date', { ascending: false })

  const total_invoiced = (invoices ?? []).reduce((s, i) => s + i.total_amount, 0)
  const total_paid     = (invoices ?? []).reduce((s, i) => s + i.amount_paid, 0)
  const balance_due    = total_invoiced - total_paid
  const overdue        = (invoices ?? [])
    .filter(i => i.payment_status === 'overdue')
    .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

  // Orders across the fulfilment lifecycle. Invoiced orders are represented by
  // their invoice (below); here we surface the stages before invoicing so the
  // customer can see what's coming and what's been delivered. draft = internal.
  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, order_date, delivery_date, status, items:wholesale_order_items(id)')
    .eq('customer_id', customer.id)
    .neq('status', 'draft')
    .order('delivery_date', { ascending: false })

  const invoicedOrderIds = new Set((invoices ?? []).map(i => i.order_id).filter(Boolean))
  const awaiting  = (orders ?? []).filter(o => o.status === 'confirmed'  && !invoicedOrderIds.has(o.id))
  const delivered = (orders ?? []).filter(o => o.status === 'dispatched' && !invoicedOrderIds.has(o.id))
  const cancelled = (orders ?? []).filter(o => o.status === 'cancelled')
  const itemCount = (o: { items?: unknown[] }) => (o.items ?? []).length

  return (
    <div className="page pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{customer.name}</h1>
          <p className="text-[var(--text-muted)] text-sm">Customer portal</p>
        </div>
        <form action={logout}>
          <button className="text-[var(--text-muted)] text-sm">Sign out</button>
        </form>
      </div>

      {/* Place an order */}
      <Link href="/portal/order"
        className="btn-primary block text-center py-3.5 font-semibold mb-6">
        + Place an order
      </Link>

      {/* Awaiting delivery (placed, not yet delivered) */}
      {awaiting.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Awaiting delivery</h2>
          <div className="space-y-2">
            {awaiting.map(o => <OrderRow key={o.id} o={o} count={itemCount(o)} kind="pending" />)}
          </div>
        </section>
      )}

      {/* Delivered but not yet invoiced (the delivery notes) */}
      {delivered.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-3">Delivered · awaiting invoice</h2>
          <div className="space-y-2">
            {delivered.map(o => <OrderRow key={o.id} o={o} count={itemCount(o)} kind="delivered" />)}
          </div>
        </section>
      )}

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-[var(--text-muted)] text-xs mb-1">Balance due</p>
          <p className={`text-2xl font-bold ${balance_due > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {pence(balance_due)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-[var(--text-muted)] text-xs mb-1">Overdue</p>
          <p className={`text-2xl font-bold ${overdue > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {pence(overdue)}
          </p>
        </div>
      </div>

      {/* Invoices */}
      <h2 className="font-semibold mb-3">Your invoices</h2>
      {(!invoices || invoices.length === 0) ? (
        <div className="card text-center py-8">
          <p className="text-[var(--text-muted)]">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <Link key={inv.id} href={`/portal/invoices/${inv.id}`}>
              <div className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{inv.invoice_number}</p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {new Date(inv.invoice_date).toLocaleDateString('en-GB')}
                    {' · due '}{new Date(inv.due_date).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{pence(inv.total_amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[inv.payment_status] ?? ''}`}>
                    {inv.payment_status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Cancelled (de-emphasised, so they aren't left wondering) */}
      {cancelled.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold mb-3 text-[var(--text-muted)]">Cancelled</h2>
          <div className="space-y-2">
            {cancelled.map(o => <OrderRow key={o.id} o={o} count={itemCount(o)} kind="cancelled" />)}
          </div>
        </section>
      )}

      <div className="mt-6 text-center text-[var(--text-muted)] text-xs">
        <p>Fresh &amp; Fruity · 193 Coatsworth Road, Gateshead NE8 1SR</p>
      </div>
    </div>
  )
}

function OrderRow({ o, count, kind }: {
  o: { id: string; order_date: string; delivery_date: string | null; status: string }
  count: number
  kind: 'pending' | 'delivered' | 'cancelled'
}) {
  const pill = kind === 'pending'  ? 'bg-blue-900 text-blue-300'
             : kind === 'delivered' ? 'bg-green-900 text-green-300'
             : 'bg-zinc-700 text-zinc-400'
  const label = kind === 'pending' ? 'Awaiting delivery'
              : kind === 'delivered' ? 'Delivered'
              : 'Cancelled'
  const title = kind === 'delivered' ? 'Delivery note' : 'Order'
  const headlineDate = kind === 'delivered' ? (o.delivery_date ?? o.order_date) : o.order_date
  return (
    <Link href={`/portal/orders/${o.id}`}>
      <div className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{title} · {fmtDate(headlineDate)}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {count} item{count === 1 ? '' : 's'}
            {kind === 'pending' && o.delivery_date ? ` · for ${fmtDate(o.delivery_date)}` : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pill}`}>{label}</span>
      </div>
    </Link>
  )
}
