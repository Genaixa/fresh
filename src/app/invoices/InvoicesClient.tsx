'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import type { ArchiveInvoice } from './page'

// ── helpers ────────────────────────────────────────────────────────────────────

const DOC_LABEL: Record<string, string> = {
  invoice:        'Invoice',
  statement:      'Statement',
  'produce-ticket': 'Produce Ticket',
  other:          'Other',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtMonthYear(ym: string) {
  if (ym === 'unknown') return 'Unknown date'
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function ymKey(date: string | null) {
  return date ? date.slice(0, 7) : 'unknown'
}

function currentAndPrevYM() {
  const now  = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const fmt  = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return [fmt(now), fmt(prev)]
}

// ── supplier summary ───────────────────────────────────────────────────────────

interface SupplierSummary {
  name: string
  count: number
  latest: string | null
  oldest: string | null
}

function buildSuppliers(invoices: ArchiveInvoice[]): SupplierSummary[] {
  const map = new Map<string, ArchiveInvoice[]>()
  for (const inv of invoices) {
    const key = inv.supplier || 'Unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(inv)
  }
  return Array.from(map.entries())
    .map(([name, invs]) => {
      const dated = invs.filter(i => i.date).sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '')
      )
      return {
        name,
        count:  invs.length,
        latest: dated[0]?.date ?? null,
        oldest: dated[dated.length - 1]?.date ?? null,
      }
    })
    .sort((a, b) => (b.latest ?? '').localeCompare(a.latest ?? ''))
}

// ── supplier tiles ─────────────────────────────────────────────────────────────

function SupplierTiles({
  suppliers,
  onSelect,
}: {
  suppliers: SupplierSummary[]
  onSelect: (name: string) => void
}) {
  if (suppliers.length === 0) {
    return (
      <p className="text-center text-[var(--text-muted)] py-12">
        No invoices found.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {suppliers.map(s => (
        <button
          key={s.name}
          onClick={() => onSelect(s.name)}
          className="card w-full text-left flex items-center justify-between
                     min-h-[72px] active:scale-[0.99] transition-transform"
        >
          <div>
            <p className="font-bold text-base">{s.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {s.count} document{s.count !== 1 ? 's' : ''}
              {s.oldest && s.latest
                ? ` · ${fmtDate(s.oldest)} – ${fmtDate(s.latest)}`
                : ''}
            </p>
          </div>
          <span className="text-[var(--text-muted)] text-2xl ml-4 leading-none">›</span>
        </button>
      ))}
    </div>
  )
}

// ── month group ────────────────────────────────────────────────────────────────

function MonthGroup({
  ym,
  invoices,
  open,
  onToggle,
  linkToPdf,
}: {
  ym: string
  invoices: ArchiveInvoice[]
  open: boolean
  onToggle: () => void
  linkToPdf?: boolean
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[52px]"
      >
        <span className="font-semibold">{fmtMonthYear(ym)}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">{invoices.length}</span>
          <span
            className="text-[var(--text-muted)] text-lg leading-none transition-transform duration-200"
            style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ›
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {invoices.map(inv => (
            linkToPdf ? (
              <a
                key={inv.id}
                href={`http://72.62.210.21:8000/invoices/${inv.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 min-h-[52px]
                           active:bg-white/5 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{fmtDate(inv.date)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {DOC_LABEL[inv.doc_type] ?? inv.doc_type}
                    {inv.invoice_number ? ` · ${inv.invoice_number}` : ''}
                  </p>
                </div>
                <span className="text-[var(--text-muted)] text-sm ml-4">PDF ↗</span>
              </a>
            ) : (
              <Link
                key={inv.id}
                href={`/invoices/archive/${inv.id}`}
                className="flex items-center justify-between px-4 py-3 min-h-[52px]
                           active:bg-white/5 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{fmtDate(inv.date)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {DOC_LABEL[inv.doc_type] ?? inv.doc_type}
                    {inv.invoice_number ? ` · ${inv.invoice_number}` : ''}
                  </p>
                </div>
                <span className="text-[var(--text-muted)] text-sm ml-4">›</span>
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ── supplier detail view ───────────────────────────────────────────────────────

function buildGroups(invoices: ArchiveInvoice[]) {
  const groupMap = new Map<string, ArchiveInvoice[]>()
  for (const inv of invoices) {
    const ym = ymKey(inv.date)
    if (!groupMap.has(ym)) groupMap.set(ym, [])
    groupMap.get(ym)!.push(inv)
  }
  return Array.from(groupMap.entries()).sort((a, b) => {
    if (a[0] === 'unknown') return 1
    if (b[0] === 'unknown') return -1
    return b[0].localeCompare(a[0])
  })
}

function SupplierView({
  supplier,
  invoices,
  onBack,
}: {
  supplier: string
  invoices: ArchiveInvoice[]
  onBack: () => void
}) {
  const invoiceDocs  = invoices.filter(i => i.doc_type === 'invoice' || i.doc_type === 'produce-ticket')
  const statementDocs = invoices.filter(i => i.doc_type === 'statement')

  const invoiceGroups   = buildGroups(invoiceDocs)
  const statementGroups = buildGroups(statementDocs)

  const [currentYM, prevYM] = currentAndPrevYM()

  const defaultCollapsed = (groups: [string, ArchiveInvoice[]][]) =>
    new Set(groups.map(([ym]) => ym).filter(ym => ym !== currentYM && ym !== prevYM))

  const [invCollapsed,  setInvCollapsed]  = useState<Set<string>>(() => defaultCollapsed(invoiceGroups))
  const [stmtCollapsed, setStmtCollapsed] = useState<Set<string>>(() => defaultCollapsed(statementGroups))
  const [statementsOpen, setStatementsOpen] = useState(false)

  function toggle(_set: Set<string>, setter: Dispatch<SetStateAction<Set<string>>>, ym: string) {
    setter((prev: Set<string>) => {
      const next = new Set(prev)
      next.has(ym) ? next.delete(ym) : next.add(ym)
      return next
    })
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-brand-accent text-sm font-medium min-h-[40px] flex items-center"
        >
          ‹ Suppliers
        </button>
        <h1 className="text-xl font-bold flex-1 truncate">{supplier}</h1>
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
          {invoices.length} docs
        </span>
      </div>

      <div className="space-y-2">
        {invoiceGroups.map(([ym, invs]) => (
          <MonthGroup
            key={ym}
            ym={ym}
            invoices={invs}
            open={!invCollapsed.has(ym)}
            onToggle={() => toggle(invCollapsed, setInvCollapsed, ym)}
          />
        ))}
        {invoiceDocs.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">No invoices</p>
        )}
      </div>

      {statementDocs.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setStatementsOpen(v => !v)}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2 font-medium"
          >
            <span
              style={{ display: 'inline-block', transform: statementsOpen ? 'rotate(90deg)' : 'none' }}
              className="transition-transform"
            >›</span>
            Statements ({statementDocs.length})
          </button>
          {statementsOpen && (
            <div className="space-y-2">
              {statementGroups.map(([ym, invs]) => (
                <MonthGroup
                  key={ym}
                  ym={ym}
                  invoices={invs}
                  open={!stmtCollapsed.has(ym)}
                  onToggle={() => toggle(stmtCollapsed, setStmtCollapsed, ym)}
                  linkToPdf
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── root export ────────────────────────────────────────────────────────────────

export function InvoicesClient({ invoices }: { invoices: ArchiveInvoice[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  const bySupplier = new Map<string, ArchiveInvoice[]>()
  for (const inv of invoices) {
    const key = inv.supplier || 'Unknown'
    if (!bySupplier.has(key)) bySupplier.set(key, [])
    bySupplier.get(key)!.push(inv)
  }

  if (selected) {
    return (
      <SupplierView
        supplier={selected}
        invoices={bySupplier.get(selected) ?? []}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <SupplierTiles
      suppliers={buildSuppliers(invoices)}
      onSelect={setSelected}
    />
  )
}
