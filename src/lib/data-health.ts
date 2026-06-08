/**
 * Central data-quality checks — single source of truth called from
 * dashboard, invoice review, price monitor, and products pages.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type HealthSeverity = 'critical' | 'warning' | 'info'

export type ProductHealthType =
  | 'at_loss'      // cost > retail
  | 'below_floor'  // margin < floor
  | 'unpriced'     // retail = 0, cost > 0
  | 'no_cost'      // cost = 0 (can't price accurately)
  | 'cost_spike'   // cost jumped >40% vs 4-week avg

export interface ProductHealthIssue {
  productId: string
  productName: string
  category: string
  severity: HealthSeverity
  type: ProductHealthType
  detail: string
  retail: number
  cost: number
  margin?: number
}

export interface InvoiceItemAnomaly {
  itemId: string
  productId: string
  productName: string
  invoiceCost: number     // pence per retail unit on this invoice
  benchmarkCost: number   // 90-day avg per retail unit (excl. this invoice)
  changePct: number       // negative = cheaper than usual, positive = more expensive
  invoiceCount: number    // how many prior invoices in the benchmark
}

// ─── Product health checks ────────────────────────────────────────────────────

export async function getProductHealthIssues(
  supabase: SupabaseClient
): Promise<ProductHealthIssue[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, retail_price, purchase_cost, margin_floor, is_active')
    .eq('is_active', true)

  if (!products?.length) return []

  // Pull 4-week weighted avg costs to spot spikes
  const { data: weightedCosts } = await supabase
    .from('product_weighted_costs')
    .select('product_id, weighted_unit_cost_pence')

  const weightedMap = new Map<string, number>(
    (weightedCosts ?? []).map(r => [r.product_id, r.weighted_unit_cost_pence])
  )

  const issues: ProductHealthIssue[] = []

  for (const p of products) {
    const retail = p.retail_price ?? 0
    const cost   = p.purchase_cost ?? 0
    const floor  = p.margin_floor  ?? 0.2
    const margin = retail > 0 ? (retail - cost) / retail : null
    const weighted = weightedMap.get(p.id)

    const base = {
      productId:   p.id,
      productName: p.name,
      category:    p.category ?? 'other',
      retail,
      cost,
      margin: margin ?? undefined,
    }

    if (retail === 0 && cost > 0) {
      issues.push({ ...base, severity: 'warning', type: 'unpriced',
        detail: `No retail price set — cost is ${fmt(cost)}` })
      continue
    }

    if (retail > 0 && cost > retail) {
      issues.push({ ...base, severity: 'critical', type: 'at_loss',
        detail: `Selling at a loss: cost ${fmt(cost)} > retail ${fmt(retail)} (${fmtPct((retail-cost)/retail)})` })
      continue
    }

    if (margin !== null && margin < floor) {
      issues.push({ ...base, severity: 'warning', type: 'below_floor',
        detail: `Margin ${fmtPct(margin)} below floor ${fmtPct(floor)}` })
      continue
    }

    // Cost spike: weighted 7-day avg is 40%–200% above purchase_cost baseline.
    // Ratios above 3x are almost always a unit mismatch in invoice data (case
    // price vs per-unit price), not a genuine price movement — suppress them.
    if (weighted && cost > 0 && weighted > cost * 1.4 && weighted < cost * 3) {
      issues.push({ ...base, severity: 'info', type: 'cost_spike',
        detail: `Cost rose to ${fmt(weighted)} (was ${fmt(cost)}, +${Math.round((weighted/cost-1)*100)}%)` })
    }
  }

  // Sort: critical → warning → info, then alphabetically
  return issues.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 }
    return sev[a.severity] - sev[b.severity] || a.productName.localeCompare(b.productName)
  })
}

// ─── Invoice price anomaly checks ────────────────────────────────────────────

export async function getInvoiceAnomalies(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<Map<string, InvoiceItemAnomaly>> {
  // Get matched items for this invoice
  const { data: items } = await supabase
    .from('purchase_invoice_items')
    .select('id, product_id, unit_cost, unit_type, box_weight_kg, units_per_case, product:products(name)')
    .eq('invoice_id', invoiceId)
    .eq('is_matched', true)

  if (!items?.length) return new Map()

  const productIds = [...new Set(items.map(i => i.product_id).filter(Boolean))]

  // Get 90-day benchmark costs for these products, excluding this invoice
  const { data: benchmarks } = await supabase.rpc('product_cost_benchmarks', {
    p_product_ids: productIds,
    p_exclude_invoice_id: invoiceId,
  })

  const benchMap = new Map<string, { avg: number; count: number }>(
    (benchmarks ?? []).map((b: { product_id: string; avg_cost_pence: number; invoice_count: number }) =>
      [b.product_id, { avg: b.avg_cost_pence, count: b.invoice_count }]
    )
  )

  const anomalies = new Map<string, InvoiceItemAnomaly>()

  for (const item of items) {
    if (!item.product_id) continue
    const bench = benchMap.get(item.product_id)
    if (!bench || bench.count < 2) continue  // need at least 2 prior invoices for a benchmark

    // Normalise this invoice's cost to per-retail-unit (same formula as weighted cost view)
    const divisor = item.unit_type === 'weight' && item.box_weight_kg
      ? item.box_weight_kg
      : (item.units_per_case ?? 1)
    const perUnit = item.unit_cost / divisor
    const changePct = Math.round((perUnit / bench.avg - 1) * 100)

    // Flag if >40% cheaper (possible credit/error) or >40% more expensive (cost spike)
    if (Math.abs(changePct) >= 40) {
      anomalies.set(item.id, {
        itemId:        item.id,
        productId:     item.product_id,
        productName:   (item.product as unknown as { name: string } | null)?.name ?? '',
        invoiceCost:   Math.round(perUnit),
        benchmarkCost: bench.avg,
        changePct,
        invoiceCount:  bench.count,
      })
    }
  }

  return anomalies
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(p: number): string {
  if (p < 100) return `${p}p`
  return `£${(p / 100).toFixed(2)}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}
