'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MarkPaidButton from './MarkPaidButton'

export type PortalInvoice = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total_amount: number
  payment_status: string
}

type SortKey = 'invoice_number' | 'invoice_date' | 'due_date' | 'total_amount' | 'payment_status'

const STATUS_STYLE: Record<string, string> = {
  paid:    'bg-green-900 text-green-300',
  partial: 'bg-yellow-900 text-yellow-300',
  overdue: 'bg-red-900 text-red-300',
  unpaid:  'bg-zinc-700 text-zinc-300',
}

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

export default function InvoiceTable({
  invoices,
  initialSort = 'due_date',
  initialDir = 'asc',
}: {
  invoices: PortalInvoice[]
  initialSort?: SortKey
  initialDir?: 'asc' | 'desc'
}) {
  const router = useRouter()
  const [sort, setSort] = useState<SortKey>(initialSort)
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir)

  const sorted = [...invoices].sort((a, b) => {
    const cmp =
      sort === 'total_amount'
        ? a.total_amount - b.total_amount
        : String(a[sort]).localeCompare(String(b[sort]))
    return dir === 'asc' ? cmp : -cmp
  })

  function toggle(key: SortKey) {
    if (key === sort) {
      setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      // Amounts read most-useful high-to-low; everything else low-to-high.
      setDir(key === 'total_amount' ? 'desc' : 'asc')
    }
  }

  const arrow = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '')

  const headCls = 'text-[var(--text-muted)] text-xs font-medium whitespace-nowrap'
  const btnCls = 'inline-flex items-center hover:text-[var(--text)] transition-colors'

  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className={`${headCls} px-3 py-2`}>
              <button className={btnCls} onClick={() => toggle('invoice_number')} aria-label="Sort by invoice number">
                Invoice{arrow('invoice_number')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 hidden sm:table-cell`}>
              <button className={btnCls} onClick={() => toggle('invoice_date')} aria-label="Sort by issue date">
                Issued{arrow('invoice_date')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 hidden sm:table-cell`}>
              <button className={btnCls} onClick={() => toggle('due_date')} aria-label="Sort by due date">
                Due{arrow('due_date')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('total_amount')} aria-label="Sort by amount">
                Amount{arrow('total_amount')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('payment_status')} aria-label="Sort by status">
                Status{arrow('payment_status')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(inv => (
            <tr
              key={inv.id}
              onClick={() => router.push(`/portal/invoices/${inv.id}`)}
              className="border-b border-zinc-800 last:border-0 cursor-pointer hover:bg-zinc-800/50 transition-colors"
            >
              <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{inv.invoice_number}</td>
              <td className="px-3 py-2.5 text-[var(--text-muted)] text-xs whitespace-nowrap hidden sm:table-cell">
                {fmtDate(inv.invoice_date)}
              </td>
              <td className="px-3 py-2.5 text-[var(--text-muted)] text-xs whitespace-nowrap hidden sm:table-cell">
                {fmtDate(inv.due_date)}
              </td>
              <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{pence(inv.total_amount)}</td>
              <td className="px-3 py-2.5 text-right">
                <div className="inline-flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[inv.payment_status] ?? ''}`}>
                    {inv.payment_status}
                  </span>
                  {inv.payment_status !== 'paid' && (
                    <MarkPaidButton invoiceId={inv.id} variant="row" />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
