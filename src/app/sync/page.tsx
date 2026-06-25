import { createClient } from '@/lib/supabase/server'
import { EposLinkPanel } from '@/components/EposLinkPanel'
import Link from 'next/link'

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const error = params.error

  // Products for EPOS link panel
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, category, epos_now_id')
    .eq('is_active', true)
    .order('name')

  const { data: lastExport } = await supabase
    .from('price_history')
    .select('created_at')
    .eq('reason', 'epos_export')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Group imported months
  const { data: importRows } = await supabase
    .from('sales_data')
    .select('sale_date')
    .eq('source', 'epos_month_import')
    .order('sale_date', { ascending: false })
    .limit(600)

  const seenDates = new Set<string>()
  const importedMonths: string[] = []
  for (const row of (importRows ?? [])) {
    if (!seenDates.has(row.sale_date)) {
      seenDates.add(row.sale_date)
      importedMonths.push(row.sale_date)
    }
  }

  // Default period to current month
  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">EPOS Now Sync</h1>
      </div>

      {error && (
        <div className="card border border-status-red/40 mb-4">
          <p className="text-status-red text-sm">{decodeURIComponent(error)}</p>
        </div>
      )}

      {/* Export prices to EPOS */}
      <div className="card mb-4">
        <p className="font-semibold mb-1">Export prices to EPOS</p>
        {lastExport && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Last export: {new Date(lastExport.created_at).toLocaleString('en-GB')}
          </p>
        )}
        <a href="/api/sync/export-csv" download="fresh-fruity-prices.csv"
           className="btn-primary w-full">
          Download Price CSV
        </a>
      </div>

      {/* Import prices FROM EPOS (EPOS = source of truth for retail price) */}
      <div className="card mb-4">
        <p className="font-semibold mb-1">Import prices from EPOS</p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Pull retail prices from the EPOS Now product export so the catalogue mirrors
          the till. Large swings are held for review.
        </p>
        <Link href="/sync/prices" className="btn-primary w-full text-center block">
          Sync retail prices
        </Link>
      </div>

      {/* Import sales from EPOS */}
      <div className="card mb-4">
        <p className="font-semibold mb-1">Import sales from EPOS</p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Upload the Sales by Product report from EPOS Now
        </p>
        <form action="/api/sync/import-sales" method="POST" encType="multipart/form-data">
          <label className="text-xs text-[var(--text-muted)] block mb-1">Sales month</label>
          <input
            type="month"
            name="period"
            defaultValue={defaultPeriod}
            required
            className="input-field mb-3 w-full"
          />
          <input type="file" name="csv" accept=".csv,.txt,.tsv" required
                 className="input-field mb-3 text-sm w-full" />
          <button type="submit" className="btn-primary w-full">
            Upload Sales Report
          </button>
        </form>
      </div>

      {/* EPOS product ID management */}
      {allProducts && allProducts.length > 0 && (
        <div className="mb-4">
          <EposLinkPanel products={allProducts} />
        </div>
      )}

      {/* Import history */}
      {importedMonths.length > 0 && (
        <div>
          <p className="section-title">Imported months</p>
          <div className="space-y-2">
            {importedMonths.slice(0, 12).map(date => {
              const [year, month] = date.split('-')
              const label = new Date(parseInt(year), parseInt(month) - 1, 1)
                .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              return (
                <Link
                  key={date}
                  href={`/epos-compare?period=${date}`}
                  className="card flex items-center justify-between min-h-[48px]"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <span className="text-brand-accent text-sm">View →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
