import type { Product, EposCsvRow } from '@/types'
import { formatPrice } from './pricing-engine'

/** Generate a CSV string of all active products for EPOS Now import */
export function generateEposCsv(products: Product[]): string {
  const header = 'Name,SKU,Retail Price (£),Wholesale Price (£)'
  const rows = products
    .filter(p => p.is_active)
    .map(p => {
      const retail = (p.retail_price / 100).toFixed(2)
      const wholesale = p.wholesale_price > 0
        ? (p.wholesale_price / 100).toFixed(2)
        : ''
      const sku = p.epos_now_id ?? p.id.slice(0, 8)
      return `"${p.name}","${sku}",${retail},${wholesale}`
    })
  return [header, ...rows].join('\n')
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
