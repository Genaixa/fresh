import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

const STATUS_STYLE: Record<string, string> = {
  paid:     'bg-green-900 text-green-300',
  partial:  'bg-yellow-900 text-yellow-300',
  overdue:  'bg-red-900 text-red-300',
  unpaid:   'bg-zinc-700 text-zinc-300',
}

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/portal')

  // Verify this invoice belongs to the logged-in portal user
  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id')
    .eq('portal_user_id', user.id)
    .single()

  if (!customer) redirect('/portal')

  const { data: inv } = await supabase
    .from('wholesale_invoices')
    .select(`*, items:wholesale_invoice_items(*), payments:wholesale_payments(*)`)
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single()

  if (!inv) notFound()

  const balance = inv.total_amount - inv.amount_paid

  return (
    <div className="page pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal" className="text-[var(--text-muted)]">←</Link>
        <div>
          <h1 className="text-xl font-bold">{inv.invoice_number}</h1>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[inv.payment_status] ?? ''}`}>
          {inv.payment_status}
        </span>
      </div>

      <div className="card mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[var(--text-muted)] text-xs">Invoice date</p>
          <p>{fmtDate(inv.invoice_date)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">Due date</p>
          <p className={inv.payment_status === 'overdue' ? 'text-red-400' : ''}>
            {fmtDate(inv.due_date)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {(inv.items ?? []).map((item: any) => (
          <div key={item.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{item.description}</p>
              <p className="text-[var(--text-muted)] text-xs">
                {item.quantity} × {pence(item.unit_price)}
              </p>
            </div>
            <p className="font-bold">{pence(item.total_price)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="card mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Total</span>
          <span>{pence(inv.total_amount)}</span>
        </div>
        {inv.amount_paid > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Paid</span>
            <span className="text-green-400">−{pence(inv.amount_paid)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-white/10 pt-2">
          <span>Balance due</span>
          <span className={balance > 0 ? 'text-yellow-400' : 'text-green-400'}>{pence(balance)}</span>
        </div>
      </div>

      {/* Payment history */}
      {(inv.payments ?? []).length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2 text-sm">Payment history</h2>
          <div className="space-y-2">
            {inv.payments.map((p: any) => (
              <div key={p.id} className="card flex items-center justify-between text-sm">
                <div>
                  <p>{fmtDate(p.payment_date)}</p>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {p.method.replace('_', ' ')}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                </div>
                <p className="text-green-400 font-medium">{pence(p.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <a href={`/api/wholesale/invoices/${id}/pdf`} target="_blank"
        className="card block text-center text-brand-accent text-sm py-3">
        Download / Print Invoice
      </a>

      <div className="mt-6 text-center text-[var(--text-muted)] text-xs">
        <p>Fresh &amp; Fruity · 193 Coatsworth Road, Gateshead NE8 1SR</p>
        <p className="mt-1">Questions? Call us or email us</p>
      </div>
    </div>
  )
}
