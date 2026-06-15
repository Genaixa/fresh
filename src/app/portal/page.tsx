import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/login/actions'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

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

      <div className="mt-6 text-center text-[var(--text-muted)] text-xs">
        <p>Fresh &amp; Fruity · 193 Coatsworth Road, Gateshead NE8 1SR</p>
      </div>
    </div>
  )
}
