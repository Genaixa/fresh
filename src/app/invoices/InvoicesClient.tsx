'use client'

import Link from 'next/link'
import type { ConfirmedInvoice } from './page'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function groupByMonth(invoices: ConfirmedInvoice[]) {
  const map = new Map<string, ConfirmedInvoice[]>()
  for (const inv of invoices) {
    const key = inv.invoice_date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(inv)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export function InvoicesClient({ confirmed }: { confirmed: ConfirmedInvoice[] }) {
  if (confirmed.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-[var(--text-muted)]">No confirmed invoices yet.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Upload a delivery note and confirm it to see it here.
        </p>
      </div>
    )
  }

  const groups = groupByMonth(confirmed)

  return (
    <div className="space-y-4">
      <p className="section-title">History</p>
      {groups.map(([ym, invoices]) => (
        <div key={ym}>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide mb-2">
            {fmtMonthYear(ym + '-01')}
          </p>
          <div className="space-y-2">
            {invoices.map(inv => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}/review`}
                className="card flex items-center justify-between min-h-[56px]
                           active:scale-[0.99] transition-transform"
              >
                <div>
                  <p className="font-semibold text-sm">{inv.supplier_name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {fmtDate(inv.invoice_date)}
                    {inv.item_count > 0 && ` · ${inv.item_count} lines`}
                  </p>
                </div>
                <span className="text-[var(--text-muted)] text-xl ml-4">›</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
