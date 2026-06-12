import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface SaleRow {
  id: string
  product_name_raw: string
  epos_product_id: string | null
  quantity_sold: number
  revenue: number
  product_id: string | null
  product: {
    id: string
    name: string
    retail_price: number
    purchase_cost: number
    margin_floor: number
    unit: string
  } | null
}

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function formatMonth(dateStr: string) {
  const [year, month] = dateStr.split('-')
  return new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default async function EposComparePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const period = params.period ?? ''

  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    // No period in the URL → default to the latest imported month rather than
    // dead-ending on "No period selected".
    const { data: latest } = await supabase
      .from('sales_data')
      .select('sale_date')
      .eq('source', 'epos_month_import')
      .order('sale_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.sale_date) redirect(`/epos-compare?period=${latest.sale_date}`)

    return (
      <div className="page pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                         flex items-center justify-center text-xl">←</Link>
          <h1 className="text-xl font-bold">EPOS Compare</h1>
        </div>
        <div className="card text-center py-10">
          <p className="text-[var(--text-muted)] mb-4">No sales imported yet</p>
          <Link href="/sync" className="btn-primary">Upload Sales Report</Link>
        </div>
      </div>
    )
  }

  const { data: rawRows } = await supabase
    .from('sales_data')
    .select(`
      id, product_name_raw, epos_product_id, quantity_sold, revenue, product_id,
      product:products(id, name, retail_price, purchase_cost, margin_floor, unit)
    `)
    .eq('sale_date', period)
    .eq('source', 'epos_month_import')
    .order('revenue', { ascending: false })

  // Supabase returns related rows as arrays; normalise product to single object or null
  const rows: SaleRow[] = (rawRows ?? []).map((r: any) => ({
    ...r,
    product: Array.isArray(r.product) ? (r.product[0] ?? null) : r.product,
  }))

  if (rows.length === 0) {
    return (
      <div className="page pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                         flex items-center justify-center text-xl">←</Link>
          <h1 className="text-xl font-bold">EPOS Compare</h1>
        </div>
        <div className="card text-center py-10">
          <p className="text-[var(--text-muted)] mb-4">No data for {formatMonth(period)}</p>
          <Link href="/sync" className="btn-primary">Upload Sales Report</Link>
        </div>
      </div>
    )
  }

  // Categorise rows
  const selling_below_cost: SaleRow[] = []
  const price_mismatch: SaleRow[] = []
  const unlinked: SaleRow[] = []
  const ok: SaleRow[] = []

  for (const row of rows) {
    if (!row.product) {
      unlinked.push(row)
      continue
    }
    const avgSell = row.quantity_sold > 0
      ? Math.round(row.revenue / row.quantity_sold)
      : row.revenue

    const cost = row.product.purchase_cost
    if (cost > 0 && avgSell < cost) {
      selling_below_cost.push(row)
    } else {
      // Price mismatch: avg EPOS price differs from our retail by more than 10%
      const retail = row.product.retail_price
      const diff = retail > 0 ? Math.abs(avgSell - retail) / retail : 0
      if (diff > 0.10 && retail > 0) {
        price_mismatch.push(row)
      } else {
        ok.push(row)
      }
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const matched = rows.filter(r => r.product !== null).length

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                       flex items-center justify-center text-xl">←</Link>
        <div>
          <h1 className="text-xl font-bold">EPOS Compare</h1>
          <p className="text-xs text-[var(--text-muted)]">{formatMonth(period)}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-lg font-bold">{rows.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Products</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-bold">{matched}</p>
          <p className="text-xs text-[var(--text-muted)]">Linked</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-bold">{formatPrice(totalRevenue)}</p>
          <p className="text-xs text-[var(--text-muted)]">Revenue</p>
        </div>
      </div>

      {/* Selling below cost */}
      {selling_below_cost.length > 0 && (
        <section className="mb-6">
          <p className="section-title text-status-red">Selling below cost</p>
          <div className="space-y-2">
            {selling_below_cost.map(row => (
              <CompareCard key={row.id} row={row} variant="red" />
            ))}
          </div>
        </section>
      )}

      {/* Price mismatch */}
      {price_mismatch.length > 0 && (
        <section className="mb-6">
          <p className="section-title text-status-amber">EPOS price differs from system</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Avg EPOS selling price is more than 10% away from your set retail price
          </p>
          <div className="space-y-2">
            {price_mismatch.map(row => (
              <CompareCard key={row.id} row={row} variant="amber" />
            ))}
          </div>
        </section>
      )}

      {/* Unlinked */}
      {unlinked.length > 0 && (
        <section className="mb-6">
          <p className="section-title">Not linked to products</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Set the EPOS ID on a product to link it — Settings on each product page
          </p>
          <div className="space-y-2">
            {unlinked.map(row => (
              <UnlinkedCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* OK products */}
      {ok.length > 0 && (
        <details>
          <summary className="section-title cursor-pointer list-none flex items-center gap-1">
            All good ({ok.length})
            <span className="text-xs group-open:rotate-180 transition-transform inline-block">▼</span>
          </summary>
          <div className="space-y-2 mt-3">
            {ok.map(row => (
              <CompareCard key={row.id} row={row} variant="ok" />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function CompareCard({
  row,
  variant,
}: {
  row: SaleRow
  variant: 'red' | 'amber' | 'ok'
}) {
  const p = row.product!
  const avgSell = row.quantity_sold > 0
    ? Math.round(row.revenue / row.quantity_sold)
    : row.revenue

  const isKg = p.unit === 'kg'
  const unit = isKg ? '/kg' : ' each'
  const margin = p.purchase_cost > 0
    ? ((avgSell - p.purchase_cost) / avgSell) * 100
    : null

  const borderColor =
    variant === 'red' ? 'border-status-red/30' :
    variant === 'amber' ? 'border-status-amber/30' : ''

  const dot =
    variant === 'red' ? 'text-status-red' :
    variant === 'amber' ? 'text-status-amber' : 'text-status-green'

  return (
    <div className={`card ${borderColor ? `border ${borderColor}` : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${dot}`}>●</span>
            <p className="font-medium text-sm truncate">{p.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--text-muted)]">
            <span>Sold: {isKg ? `${row.quantity_sold.toFixed(1)}kg` : `${Math.round(row.quantity_sold)}`}</span>
            <span>Revenue: {formatPrice(row.revenue)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{formatPrice(avgSell)}{unit}</p>
          {p.retail_price > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              System: {formatPrice(p.retail_price)}{unit}
            </p>
          )}
          {margin !== null && (
            <p className={`text-xs font-medium ${margin < 0 ? 'text-status-red' : margin < p.margin_floor * 100 ? 'text-status-amber' : 'text-status-green'}`}>
              {margin.toFixed(0)}% margin
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function UnlinkedCard({ row }: { row: SaleRow }) {
  const avgSell = row.quantity_sold > 0
    ? Math.round(row.revenue / row.quantity_sold)
    : row.revenue

  return (
    <div className="card opacity-70">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{row.product_name_raw}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {row.epos_product_id ? `EPOS ID: ${row.epos_product_id}` : 'No EPOS ID'} · Revenue: {formatPrice(row.revenue)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm">{formatPrice(avgSell)}</p>
          <p className="text-xs text-[var(--text-muted)]">avg</p>
        </div>
      </div>
    </div>
  )
}
