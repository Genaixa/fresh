import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const money = (p: number | null) => (p == null ? '—' : `£${(p / 100).toFixed(2)}`)

export default async function ImportPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { run, error } = await searchParams

  let rows: {
    epos_name: string; matched_name: string | null
    old_retail: number | null; new_retail: number; status: string; reason: string | null
  }[] = []
  if (run) {
    const { data } = await supabase
      .from('epos_price_sync_log')
      .select('epos_name, matched_name, old_retail, new_retail, status, reason')
      .eq('run_id', run)
      .order('status')
    rows = data ?? []
  }

  const applied   = rows.filter(r => r.status === 'applied')
  const review    = rows.filter(r => r.status === 'review')
  const unmatched = rows.filter(r => r.status === 'unmatched')
  const nochange  = rows.filter(r => r.status === 'nochange')

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sync" className="text-brand-accent min-h-[48px] min-w-[48px]
                                       flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Import prices from EPOS</h1>
      </div>

      {error && (
        <div className="card border border-status-red/40 mb-4">
          <p className="text-status-red text-sm">{decodeURIComponent(error)}</p>
        </div>
      )}

      <div className="card mb-4">
        <p className="font-semibold mb-1">Upload EPOS product export</p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          EPOS Now owns the shelf price. Upload the product/items export (CSV with a
          <span className="font-mono"> SalePriceIncTax </span> column). Normal corrections
          apply automatically; large swings are held for review (unit mismatches).
        </p>
        <form action="/api/sync/import-prices" method="POST" encType="multipart/form-data">
          <input type="file" name="csv" accept=".csv,.txt" required
                 className="input-field mb-3 text-sm w-full" />
          <button type="submit" className="btn-primary w-full">Sync prices</button>
        </form>
      </div>

      {run && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Stat label="Applied"   value={applied.length}   tone="text-status-green" />
            <Stat label="Review"    value={review.length}    tone="text-status-amber" />
            <Stat label="No change" value={nochange.length}  tone="text-[var(--text-muted)]" />
            <Stat label="Unmatched" value={unmatched.length} tone="text-[var(--text-muted)]" />
          </div>

          {applied.length > 0 && (
            <Section title={`Applied (${applied.length})`}>
              {applied.map((r, i) => (
                <Row key={i} name={r.matched_name ?? r.epos_name}
                     detail={`${money(r.old_retail)} → ${money(r.new_retail)}`}
                     tone="text-status-green" />
              ))}
            </Section>
          )}

          {review.length > 0 && (
            <Section title={`Held for review (${review.length})`}>
              {review.map((r, i) => (
                <div key={i} className="py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex justify-between text-sm">
                    <span>{r.matched_name ?? r.epos_name}</span>
                    <span className="text-status-amber">{money(r.old_retail)} → {money(r.new_retail)}</span>
                  </div>
                  {r.reason && <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.reason}</p>}
                </div>
              ))}
            </Section>
          )}

          {unmatched.length > 0 && (
            <Section title={`Unmatched buttons (${unmatched.length})`}>
              {unmatched.map((r, i) => (
                <Row key={i} name={r.epos_name} detail={money(r.new_retail)}
                     tone="text-[var(--text-muted)]" />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card text-center py-3">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="section-title">{title}</p>
      <div className="card">{children}</div>
    </div>
  )
}

function Row({ name, detail, tone }: { name: string; detail: string; tone: string }) {
  return (
    <div className="flex justify-between text-sm py-2 border-b border-[var(--border)] last:border-0">
      <span>{name}</span>
      <span className={tone}>{detail}</span>
    </div>
  )
}
