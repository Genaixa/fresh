'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { EmailInvoiceButton } from './EmailInvoiceButton'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

const STATUS_STYLE: Record<string, string> = {
  paid:     'bg-green-900 text-green-300',
  partial:  'bg-yellow-900 text-yellow-300',
  overdue:  'bg-red-900 text-red-300',
  unpaid:   'bg-zinc-700 text-zinc-300',
}

export default function InvoiceDetailPage() {
  const params  = useParams()
  const id      = params.id as string

  const [invoice, setInvoice]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [showPayment, setShowPayment] = useState(false)

  // Payment form state
  const [amount, setAmount]     = useState('')
  const [method, setMethod]     = useState('bank_transfer')
  const [payDate, setPayDate]   = useState(new Date().toISOString().split('T')[0])
  const [ref, setRef]           = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function load() {
    const res = await fetch(`/api/wholesale/invoices/${id}`)
    if (res.ok) setInvoice(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function recordPayment() {
    const amountPence = Math.round(parseFloat(amount) * 100)
    if (!amountPence || amountPence <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/wholesale/invoices/${id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_pence: amountPence,
          payment_date: payDate,
          method,
          reference: ref || null,
          notes:     payNotes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowPayment(false)
      setAmount('')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><p className="text-[var(--text-muted)]">Loading…</p></div>
  if (!invoice) return <div className="page"><p className="text-red-400">Invoice not found</p></div>

  const balance = invoice.total_amount - invoice.amount_paid

  return (
    <div className="page pb-32">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/wholesale/customers/${invoice.customer_id}`} className="text-[var(--text-muted)]">←</Link>
        <div>
          <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
          <p className="text-[var(--text-muted)] text-sm">{invoice.customer?.name}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[invoice.payment_status] ?? ''}`}>
          {invoice.payment_status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <a href={`/api/invoices/${invoice.id}/export?format=pdf`} className="card block text-center text-brand-accent text-sm py-3 font-medium">⬇ PDF</a>
        <a href={`/api/invoices/${invoice.id}/export?format=csv`} className="card block text-center text-brand-accent text-sm py-3 font-medium">⬇ CSV / Excel</a>
      </div>

      <EmailInvoiceButton invoiceId={invoice.id} />

      {/* Dates */}
      <div className="card mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[var(--text-muted)] text-xs">Invoice date</p>
          <p>{fmtDate(invoice.invoice_date)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">Due date</p>
          <p className={invoice.payment_status === 'overdue' ? 'text-red-400' : ''}>
            {fmtDate(invoice.due_date)}
          </p>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-2 mb-4">
        {(invoice.items ?? []).map((item: any) => (
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
          <span className="text-[var(--text-muted)]">Subtotal</span>
          <span>{pence(invoice.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Paid</span>
          <span className="text-green-400">−{pence(invoice.amount_paid)}</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t border-white/10 pt-2">
          <span>Balance due</span>
          <span className={balance > 0 ? 'text-yellow-400' : 'text-green-400'}>{pence(balance)}</span>
        </div>
      </div>

      {/* Payment history */}
      {(invoice.payments ?? []).length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2 text-sm">Payment history</h2>
          <div className="space-y-2">
            {invoice.payments.map((p: any) => (
              <div key={p.id} className="card flex items-center justify-between text-sm">
                <div>
                  <p>{fmtDate(p.payment_date)}</p>
                  <p className="text-[var(--text-muted)] text-xs capitalize">
                    {p.method.replace('_', ' ')}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                  {p.notes && (
                    <p className="text-amber-400/80 text-xs mt-0.5 normal-case">{p.notes}</p>
                  )}
                </div>
                <p className="text-green-400 font-medium">{pence(p.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="card mb-4 text-sm text-[var(--text-muted)]">
          {invoice.notes}
        </div>
      )}

      {/* PDF download */}
      <a href={`/api/wholesale/invoices/${id}/pdf`} target="_blank"
        className="card block text-center text-brand-accent text-sm mb-4 py-3">
        Download PDF Invoice
      </a>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* Record payment — slide up panel */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end" onClick={() => setShowPayment(false)}>
          <div className="bg-[var(--bg-card)] w-full max-w-lg mx-auto rounded-t-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-lg">Record Payment</h2>
            <div>
              <label className="label">Amount (£)</label>
              <input className="input text-2xl font-bold" type="number" min="0.01" step="0.01"
                placeholder={`Max ${pence(balance)}`}
                value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={payDate}
                onChange={e => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Reference</label>
              <input className="input" value={ref} onChange={e => setRef(e.target.value)}
                placeholder="Bank ref, cheque number…" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowPayment(false)}
                className="flex-1 py-3 rounded-xl border border-white/20 text-sm">
                Cancel
              </button>
              <button onClick={recordPayment} disabled={saving}
                className="flex-1 btn-primary py-3 text-sm">
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {balance > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-[var(--bg-main)] border-t border-white/10">
          <button onClick={() => setShowPayment(true)}
            className="btn-primary w-full py-4 text-lg font-semibold">
            Record Payment
          </button>
        </div>
      )}
    </div>
  )
}
