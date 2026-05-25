'use client'

import Link from 'next/link'
import type { ArchiveInvoiceFull, Delivery } from './page'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function InvoiceDetail({
  invoice,
  deliveries,
}: {
  invoice: ArchiveInvoiceFull
  deliveries: Delivery[]
}) {
  return (
    <>
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/invoices"
          className="text-brand-accent text-sm font-medium min-h-[40px] flex items-center"
        >
          ‹ Invoices
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">
            {invoice.invoice_number ?? invoice.reference ?? `Invoice #${invoice.id}`}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {invoice.supplier} · {fmtDate(invoice.date)}
          </p>
        </div>
      </div>

      {/* PDF link */}
      <a
        href={`http://72.62.210.21:8000/invoices/${invoice.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
        className="card flex items-center justify-between mb-6 min-h-[48px]
                   active:scale-[0.99] transition-transform"
      >
        <span className="text-sm font-medium">{invoice.filename}</span>
        <span className="text-brand-accent text-sm ml-4">Download PDF ↗</span>
      </a>

      {/* no deliveries */}
      {deliveries.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-[var(--text-muted)] text-sm">
            No line items extracted for this invoice.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Only invoices and produce tickets are parsed — statements have no line items.
          </p>
        </div>
      )}

      {/* delivery list */}
      {deliveries.length > 0 && (
        <div className="space-y-2">
          {deliveries.map(d => (
            <Link
              key={d.ticket_key}
              href={`/invoices/archive/${invoice.id}/${d.ticket_key}`}
              className="card flex items-center justify-between min-h-[64px]
                         active:scale-[0.99] transition-transform"
            >
              <div>
                <p className="font-semibold text-sm">
                  {d.delivery_date ? fmtDate(d.delivery_date) : fmtDate(invoice.date)}
                </p>
                {d.ticket_number && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Ticket {d.ticket_number}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="text-xs text-[var(--text-muted)]">
                  {d.item_count} item{d.item_count !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--text-muted)] text-xl leading-none">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
