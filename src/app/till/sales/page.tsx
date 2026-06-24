import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/pricing-engine'
import { VoidButton } from './VoidButton'

export const dynamic = 'force-dynamic'

type SaleItem = {
  product_name: string
  quantity: number
  unit: string
  line_total_pence: number
}

type Sale = {
  id: string
  created_at: string
  total_pence: number
  payment_method: 'cash' | 'card' | 'mixed'
  cash_tendered_pence: number | null
  change_pence: number | null
  status: 'completed' | 'voided'
  items: SaleItem[]
}

// Start-of-today in Europ/London as a UTC ISO instant (DST-safe).
function londonStartOfTodayISO(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const y = get('year'), mo = get('month'), d = get('day')
  const h = get('hour'), mi = get('minute'), s = get('second')
  // Offset between the actual instant and the London wall-clock read as if UTC.
  const offset = Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(now.getTime() / 1000) * 1000
  const startWallAsUtc = Date.UTC(y, mo - 1, d, 0, 0, 0)
  return new Date(startWallAsUtc - offset).toISOString()
}

function londonTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  })
}

export default async function TillSalesPage() {
  const supabase = await createClient()
  const since = londonStartOfTodayISO()

  const { data } = await supabase
    .from('till_transactions')
    .select(
      'id, created_at, total_pence, payment_method, cash_tendered_pence, change_pence, status, ' +
      'items:till_transaction_items(product_name, quantity, unit, line_total_pence)'
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const sales = (data ?? []) as unknown as Sale[]
  const completed = sales.filter(s => s.status === 'completed')
  const cashTotal = completed.filter(s => s.payment_method === 'cash').reduce((t, s) => t + s.total_pence, 0)
  const cardTotal = completed.filter(s => s.payment_method === 'card').reduce((t, s) => t + s.total_pence, 0)
  const grand = cashTotal + cardTotal
  const voidedCount = sales.length - completed.length

  return (
    <div className="dark min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 sticky top-0 bg-[var(--bg-primary)] z-10">
        <span className="font-bold text-brand-accent">Today&apos;s Sales</span>
        <Link href="/till" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">
          ← Till
        </Link>
      </div>

      <div className="max-w-2xl mx-auto p-3 space-y-3">
        {/* Day summary — reconcile against the Epos Now Z-report */}
        <div className="grid grid-cols-4 gap-2">
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Sales</p>
            <p className="text-xl font-bold">{completed.length}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Cash</p>
            <p className="text-xl font-bold text-status-green">{formatPrice(cashTotal)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Card</p>
            <p className="text-xl font-bold text-brand-accent">{formatPrice(cardTotal)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Total</p>
            <p className="text-xl font-bold">{formatPrice(grand)}</p>
          </div>
        </div>
        {voidedCount > 0 && (
          <p className="text-xs text-[var(--text-muted)] px-1">{voidedCount} voided (excluded from totals)</p>
        )}

        {/* Transactions */}
        {sales.length === 0 && (
          <p className="text-center text-sm text-[var(--text-muted)] py-16">No sales rung today.</p>
        )}

        {sales.map(s => {
          const voided = s.status === 'voided'
          return (
            <div key={s.id} className={`card p-3 ${voided ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{londonTime(s.created_at)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.payment_method === 'cash' ? 'bg-status-green/20 text-status-green' : 'bg-brand-accent/20 text-brand-accent'}`}>
                    {s.payment_method}
                  </span>
                  {voided && <span className="text-[10px] px-2 py-0.5 rounded-full bg-status-red/20 text-status-red">voided</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-base font-bold ${voided ? 'line-through' : ''}`}>{formatPrice(s.total_pence)}</span>
                  {!voided && <VoidButton id={s.id} />}
                </div>
              </div>
              <div className="space-y-0.5">
                {s.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-[var(--text-muted)]">
                    <span>
                      {it.unit === 'kg' ? `${Number(it.quantity).toFixed(3)} kg` : `${it.quantity} ×`} {it.product_name}
                    </span>
                    <span>{formatPrice(it.line_total_pence)}</span>
                  </div>
                ))}
              </div>
              {s.payment_method === 'cash' && s.cash_tendered_pence != null && (
                <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1.5 pt-1.5 border-t border-white/5">
                  <span>Tendered {formatPrice(s.cash_tendered_pence)}</span>
                  <span>Change {formatPrice(s.change_pence ?? 0)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
