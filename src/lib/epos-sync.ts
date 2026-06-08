import type { Product, EposCsvRow } from '@/types'
import { formatPrice } from './pricing-engine'

export interface EposMonthlyRow {
  epos_product_id: string
  name: string
  transaction_count: number
  quantity_sold: number  // kg for weight items, unit count for each
  is_by_weight: boolean
  revenue_pence: number
}

/** Generate a CSV string of all active products for EPOS Now import.
 *  Includes cost price so EPOS Now margin reports match our system.
 *  SKU uses epos_now_id (the actual EPOS product ID) for exact matching.
 *  Only exports products that have a cost set — zero-cost products would
 *  overwrite EPOS costs with 0, which is worse than leaving them alone.
 */
export function generateEposCsv(products: Product[]): string {
  const header = 'Name,SKU,Cost Price (£),Retail Price (£),Wholesale Price (£)'
  const rows = products
    .filter(p => p.is_active && p.retail_price > 0)
    .map(p => {
      const cost     = p.purchase_cost > 0 ? (p.purchase_cost / 100).toFixed(2) : ''
      const retail   = (p.retail_price / 100).toFixed(2)
      const wholesale = p.wholesale_price > 0
        ? (p.wholesale_price / 100).toFixed(2)
        : ''
      const sku = p.epos_now_id ?? ''
      return `"${p.name}","${sku}",${cost},${retail},${wholesale}`
    })
  return [header, ...rows].join('\n')
}

/**
 * Parse an EPOS Now "Sales by Product" monthly report.
 * Format: tab-separated, columns: ProductID Name Description Barcode OrderCode Brand Size Qty MeasuredQty Value
 * MeasuredQty is e.g. "86.86200kg" for weight items, empty for each items.
 */
export function parseEposMonthlyReport(text: string): {
  rows: EposMonthlyRow[]
  errors: string[]
} {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const errors: string[] = []
  const rows: EposMonthlyRow[] = []

  if (lines.length < 2) {
    errors.push('File appears empty')
    return { rows, errors }
  }

  const sep = lines[0].includes('\t') ? '\t' : ','

  // Find header row
  const headerIdx = lines.findIndex(l =>
    l.replace(/\s+/g, '').toLowerCase().includes('productid')
  )
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim())
    if (cols.length < 9) continue

    const productId = cols[0]
    if (!productId || productId.toLowerCase().startsWith('total') || productId === '') continue

    const name = cols[1]
    if (!name) continue

    const valueStr = cols[9]?.trim() ?? ''
    if (!valueStr) continue

    const value = parseFloat(valueStr)
    if (isNaN(value) || value <= 0) continue

    const transactionCount = parseInt(cols[7]?.trim() ?? '0') || 0
    const measuredQtyStr = cols[8]?.trim() ?? ''

    let quantitySold = transactionCount
    let isByWeight = false

    if (measuredQtyStr) {
      const numMatch = measuredQtyStr.match(/^([\d.]+)/)
      if (numMatch) {
        const parsed = parseFloat(numMatch[1])
        if (!isNaN(parsed) && parsed > 0) {
          quantitySold = parsed
          isByWeight = measuredQtyStr.toLowerCase().includes('kg')
        }
      }
    }

    if (quantitySold === 0) continue

    rows.push({
      epos_product_id: productId,
      name,
      transaction_count: transactionCount,
      quantity_sold: quantitySold,
      is_by_weight: isByWeight,
      revenue_pence: Math.round(value * 100),
    })
  }

  return { rows, errors }
}

/** Parse an EPOS Now sales export CSV into structured rows */
export function parseEposSalesCsv(csv: string): {
  rows: EposCsvRow[]
  errors: string[]
} {
  const lines = csv.trim().split('\n')
  const errors: string[] = []
  const rows: EposCsvRow[] = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length < 3) {
      errors.push(`Row ${i + 1}: insufficient columns`)
      continue
    }
    const retail_pence = Math.round(parseFloat(cols[2]) * 100)
    if (isNaN(retail_pence)) {
      errors.push(`Row ${i + 1}: invalid retail price "${cols[2]}"`)
      continue
    }
    rows.push({
      product_name: cols[0],
      sku: cols[1],
      retail_price_pence: retail_pence,
      wholesale_price_pence: cols[3] ? Math.round(parseFloat(cols[3]) * 100) : 0,
    })
  }

  return { rows, errors }
}
