import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import InvoiceTable from './InvoiceTable'
import OrderTable, { type PortalOrder } from './OrderTable'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDayMonth(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

type Invoice = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total_amount: number
  amount_paid: number
  payment_status: string
  order_id: string | null
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
    // Tie-break same-date invoices by number so they read newest-first.
    .order('invoice_number', { ascending: false })

  const allInvoices = (invoices ?? []) as Invoice[]
  const total_invoiced = allInvoices.reduce((s, i) => s + i.total_amount, 0)
  const total_paid     = allInvoices.reduce((s, i) => s + i.amount_paid, 0)
  const balance_due    = total_invoiced - total_paid
  const overdue        = allInvoices
    .filter(i => i.payment_status === 'overdue')
    .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

  // Split settled history from what still needs paying. Outstanding reads
  // oldest-due-first so the customer pays the most pressing one first.
  const outstanding = allInvoices
    .filter(i => i.payment_status !== 'paid')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const paid = allInvoices.filter(i => i.payment_status === 'paid')
  const nextDue = outstanding[0]?.due_date

  // Orders across the fulfilment lifecycle. Invoiced orders are represented by
  // their invoice (above); here we surface the stages before invoicing so the
  // customer can see what's coming and what's been delivered. draft = internal.
  const { data: orders } = await supabase
    .from('wholesale_orders')
    .select('id, order_date, delivery_date, status, items:wholesale_order_items(id)')
    .eq('customer_id', customer.id)
    .neq('status', 'draft')
    .order('delivery_date', { ascending: false })

  const invoicedOrderIds = new Set(allInvoices.map(i => i.order_id).filter(Boolean))
  const awaiting  = (orders ?? []).filter(o => o.status === 'confirmed'  && !invoicedOrderIds.has(o.id))
  const delivered = (orders ?? []).filter(o => o.status === 'dispatched' && !invoicedOrderIds.has(o.id))
  const cancelled = (orders ?? []).filter(o => o.status === 'cancelled')
  const itemCount = (o: { items?: unknown[] }) => (o.items ?? []).length
  const toRow = (o: typeof awaiting[number], kind: PortalOrder['kind']): PortalOrder => ({
    id: o.id, order_date: o.order_date, delivery_date: o.delivery_date, kind, count: itemCount(o),
  })
  const orderRows: PortalOrder[] = [
    ...awaiting.map(o => toRow(o, 'pending')),
    ...delivered.map(o => toRow(o, 'delivered')),
    ...cancelled.map(o => toRow(o, 'cancelled')),
  ]

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

      {/* Account summary — the numbers they came to see, up front */}
      <div className="grid grid-cols-2 gap-3 mb-1">
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
      <p className="text-center text-[var(--text-muted)] text-xs mb-6">
        {outstanding.length > 0
          ? `${outstanding.length} unpaid · next due ${fmtDayMonth(nextDue!)}`
          : 'All settled — thank you'}
      </p>

      {/* Invoices: outstanding first, paid history tucked away */}
      {allInvoices.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-[var(--text-muted)]">No invoices yet</p>
        </div>
      ) : (
        <>
          {outstanding.length > 0 && (
            <section className="mb-6">
              <h2 className="font-semibold mb-3">Outstanding invoices ({outstanding.length})</h2>
              <InvoiceTable invoices={outstanding} initialSort="due_date" initialDir="asc" />
            </section>
          )}

          {paid.length > 0 && (
            <details className="mb-6">
              <summary className="cursor-pointer select-none text-[var(--text-muted)] text-sm font-medium py-2">
                Paid ({paid.length})
              </summary>
              <div className="mt-2">
                <InvoiceTable invoices={paid} initialSort="invoice_date" initialDir="desc" />
              </div>
            </details>
          )}
        </>
      )}

      {/* Orders & deliveries — the lifecycle before invoicing, below the money */}
      {orderRows.length > 0 && (
        <section className="mb-2">
          <h2 className="font-semibold mb-3">Orders &amp; deliveries</h2>
          <OrderTable rows={orderRows} initialSort="date" initialDir="desc" />
        </section>
      )}

      <div className="mt-6 text-center text-[var(--text-muted)] text-xs">
        <p>Fresh &amp; Fruity · 193 Coatsworth Road, Gateshead NE8 1SR</p>
      </div>
    </div>
  )
}
