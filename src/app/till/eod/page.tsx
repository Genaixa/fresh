import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/pricing-engine'
import { CloseDayButton, PrintXButton } from './CloseDayButton'
import { CashControls } from './CashControls'

export const dynamic = 'force-dynamic'

type OpenRow = { total_pence: number; payment_method: string; status: string }
type CashRow = { kind: 'float_open' | 'pay_in' | 'pay_out'; amount_pence: number }
type ZReport = {
  id: string
  z_number: number
  opened_at: string | null
  closed_at: string
  gross_pence: number
  cash_pence: number
  card_pence: number
  txn_count: number
  void_count: number
  voided_pence: number
  expected_cash_pence: number
  counted_cash_pence: number | null
  cash_variance_pence: number | null
  vat_pence: number
}

function dt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function TillEodPage() {
  const supabase = await createClient()

  const [{ data: openRowsRaw }, { data: cashRaw }, { data: zRaw }] = await Promise.all([
    supabase.from('till_transactions').select('total_pence, payment_method, status').is('z_report_id', null),
    supabase.from('till_cash_movements').select('kind, amount_pence').is('z_report_id', null),
    supabase.from('till_z_reports').select('*').order('z_number', { ascending: false }).limit(30),
  ])

  const openRows = (openRowsRaw ?? []) as OpenRow[]
  const cashRows = (cashRaw ?? []) as CashRow[]
  const zReports = (zRaw ?? []) as ZReport[]

  // X-read: live totals of the open (unsealed) period.
  const completed = openRows.filter(r => r.status === 'completed')
  const x = {
    gross: completed.reduce((t, r) => t + r.total_pence, 0),
    cash: completed.filter(r => r.payment_method === 'cash').reduce((t, r) => t + r.total_pence, 0),
    card: completed.filter(r => r.payment_method === 'card').reduce((t, r) => t + r.total_pence, 0),
    txns: completed.length,
    voids: openRows.filter(r => r.status === 'voided').length,
  }
  const sumKind = (k: CashRow['kind']) => cashRows.filter(c => c.kind === k).reduce((t, c) => t + c.amount_pence, 0)
  const cash = {
    float: sumKind('float_open'),
    payIn: sumKind('pay_in'),
    payOut: sumKind('pay_out'),
  }
  const expectedCash = cash.float + x.cash + cash.payIn - cash.payOut
  const openedSince = zReports[0]?.closed_at ?? null  // last close = start of the open period

  return (
    <div className="dark min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .eod-print, .eod-print * { visibility: visible !important; }
        .eod-print { position: absolute; inset: 0; color: #000; background: #fff; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 sticky top-0 bg-[var(--bg-primary)] z-10 no-print">
        <span className="font-bold text-brand-accent">End of Day</span>
        <div className="flex items-center gap-2">
          <Link href="/till/sales" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">Sales</Link>
          <Link href="/till" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">← Till</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-3 space-y-4">
        {/* X-READ — open period */}
        <div className="eod-print card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">X-Read · open period</h2>
            <span className="text-xs text-[var(--text-muted)]">since {dt(openedSince)}</span>
          </div>
          <div className="text-center py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Takings (uncounted)</p>
            <p className="text-4xl font-bold">{formatPrice(x.gross)}</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Cash" value={formatPrice(x.cash)} tone="green" />
            <Stat label="Card" value={formatPrice(x.card)} tone="accent" />
            <Stat label="Sales" value={String(x.txns)} />
            <Stat label="Voids" value={String(x.voids)} />
          </div>
          <div className="flex gap-2 pt-1 no-print">
            <PrintXButton />
            <CloseDayButton hasSales={x.txns > 0} expectedCash={expectedCash} />
          </div>
        </div>

        {/* Cash drawer */}
        <div className="card p-4 space-y-3 no-print">
          <h2 className="font-bold">Cash drawer</h2>
          <div className="space-y-1 text-sm">
            <Row label="Opening float" value={formatPrice(cash.float)} />
            <Row label="Cash sales" value={formatPrice(x.cash)} />
            <Row label="Paid in" value={formatPrice(cash.payIn)} />
            <Row label="Paid out" value={`− ${formatPrice(cash.payOut)}`} />
            <div className="border-t border-white/10 pt-1 mt-1">
              <Row label="Expected in drawer" value={formatPrice(expectedCash)} strong />
            </div>
          </div>
          <CashControls />
        </div>

        {/* Z-READ history */}
        <div className="space-y-2">
          <h2 className="font-bold px-1">Past Z-reads</h2>
          {zReports.length === 0 && (
            <p className="text-center text-sm text-[var(--text-muted)] py-8">No day has been closed yet.</p>
          )}
          {zReports.map(z => (
            <div key={z.id} className="card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent font-semibold">Z{z.z_number}</span>
                  <span className="text-xs text-[var(--text-muted)]">{dt(z.closed_at)}</span>
                </div>
                <span className="text-base font-bold">{formatPrice(z.gross_pence)}</span>
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-[var(--text-muted)]">
                <span>Cash {formatPrice(z.cash_pence)}</span>
                <span>Card {formatPrice(z.card_pence)}</span>
                <span>{z.txn_count} sales</span>
                {z.void_count > 0 && <span>{z.void_count} voids</span>}
                {z.vat_pence > 0 && <span>VAT {formatPrice(z.vat_pence)}</span>}
              </div>
              {z.counted_cash_pence != null && (
                <div className="flex gap-4 mt-1 text-xs">
                  <span className="text-[var(--text-muted)]">
                    Drawer {formatPrice(z.counted_cash_pence)} / {formatPrice(z.expected_cash_pence)}
                  </span>
                  {z.cash_variance_pence != null && z.cash_variance_pence !== 0 && (
                    <span className="text-status-amber">
                      {z.cash_variance_pence > 0 ? 'over' : 'short'} {formatPrice(Math.abs(z.cash_variance_pence))}
                    </span>
                  )}
                  {z.cash_variance_pence === 0 && <span className="text-status-green">balanced</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={strong ? 'font-bold' : ''}>{value}</span>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'accent' }) {
  const color = tone === 'green' ? 'text-status-green' : tone === 'accent' ? 'text-brand-accent' : ''
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  )
}

