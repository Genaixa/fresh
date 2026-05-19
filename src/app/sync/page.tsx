import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SyncPage() {
  const supabase = await createClient()

  const { data: lastExport } = await supabase
    .from('price_history')
    .select('created_at')
    .eq('reason', 'epos_export')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: imports } = await supabase
    .from('sales_data')
    .select('imported_at, id')
    .order('imported_at', { ascending: false })
    .limit(5)

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">EPOS Now Sync</h1>
      </div>

      {/* Export */}
      <div className="card mb-4">
        <p className="font-semibold mb-1">Export prices to EPOS</p>
        {lastExport && (
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Last export: {new Date(lastExport.created_at).toLocaleString('en-GB')}
          </p>
        )}
        <a href="/api/sync/export-csv" download="fresh-fruity-prices.csv"
           className="btn-primary w-full">
          ⬇ Download Price CSV
        </a>
      </div>

      {/* Import */}
      <div className="card mb-4">
        <p className="font-semibold mb-1">Import sales from EPOS</p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Upload the sales export CSV from EPOS Now
        </p>
        <form action="/api/sync/import-sales" method="POST" encType="multipart/form-data">
          <input type="file" name="csv" accept=".csv" required
                 className="input-field mb-3 text-sm" />
          <button type="submit" className="btn-primary w-full">
            📤 Upload Sales CSV
          </button>
        </form>
      </div>

      {/* Import history */}
      {(imports ?? []).length > 0 && (
        <div>
          <p className="section-title">Import history</p>
          <div className="space-y-2">
            {imports!.map(row => (
              <div key={row.id} className="card flex items-center justify-between">
                <p className="text-sm">
                  {new Date(row.imported_at).toLocaleDateString('en-GB')}
                </p>
                <span className="text-status-green text-sm">●</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
