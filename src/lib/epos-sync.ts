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
  const errors: string[] = []
  const rows: EposMonthlyRow[] = []

  // Excel workbooks are zip archives — file.text() on one yields binary soup
  if (text.startsWith('PK')) {
    errors.push('That looks like an Excel (.xlsx) file — in EPOS Now export the report as CSV and upload that instead')
    return { rows, errors }
  }

  const lines = text.replace(/\r/g, '').trim().split('\n').filter(l => l.trim())

  if (lines.length < 2) {
    errors.push('File appears empty')
    return { rows, errors }
  }

  // Locate the header row FIRST — separator detection must probe the header,
  // not line 0 (exports sometimes carry a title line above it).
  const headerIdx = lines.findIndex(l =>
    l.replace(/\s+/g, '').toLowerCase().includes('productid')
  )
  const probe = lines[headerIdx >= 0 ? headerIdx : 0]

  // EPOS exports appear in the wild as tab-, comma-, semicolon- AND
  // run-of-spaces-separated. In the spaces flavour, empty columns (Barcode,
  // Brand…) collapse away entirely, so positions shift per row.
  type SepKind = 'tab' | 'comma' | 'semi' | 'spaces'
  const sepKind: SepKind =
    probe.includes('\t')                    ? 'tab'
    : (probe.match(/,/g)?.length ?? 0) >= 5 ? 'comma'
    : (probe.match(/;/g)?.length ?? 0) >= 5 ? 'semi'
    : /\s{2,}/.test(probe)                  ? 'spaces'
    : 'comma'
  const sep = sepKind // for the diagnostic message

  // Quote-aware splitter — EPOS CSVs quote names containing commas; a naive
  // split(',') shreds those rows so every row gets rejected.
  const splitLine = (line: string): string[] => {
    if (sepKind === 'tab')    return line.split('\t').map(c => c.trim())
    if (sepKind === 'spaces') return line.trim().split(/\s{2,}/).map(c => c.trim())
    const SEP = sepKind === 'semi' ? ';' : ','
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ
      } else if (ch === SEP && !inQ) {
        out.push(cur.trim()); cur = ''
      } else cur += ch
    }
    out.push(cur.trim())
    return out
  }

  // Column positions: read from the header row when present (EPOS column order
  // varies between report versions); fall back to the classic fixed layout.
  let col = { id: 0, name: 1, qty: 7, measured: 8, value: 9 }
  if (headerIdx >= 0) {
    const h = splitLine(lines[headerIdx]).map(c => c.replace(/[^a-z]/gi, '').toLowerCase())
    const find = (...names: string[]) => {
      for (const n of names) { const idx = h.indexOf(n); if (idx >= 0) return idx }
      return -1
    }
    const idCol = find('productid'), nameCol = find('name', 'productname')
    const qtyCol = find('qty', 'quantity'), measuredCol = find('measuredqty')
    const valueCol = find('value', 'valueincvat', 'totalvalue')
    if (idCol >= 0 && nameCol >= 0 && valueCol >= 0) {
      col = {
        id: idCol, name: nameCol, value: valueCol,
        qty:      qtyCol >= 0 ? qtyCol : 7,
        measured: measuredCol >= 0 ? measuredCol : 8,
      }
    }
  }
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i])

    let productId: string, name: string, valueStr: string, qtyStr: string, measuredQtyStr: string

    if (sepKind === 'spaces') {
      // Empty columns collapsed away — anchor on the fixed numeric TAIL instead:
      // … Qty [MeasuredQty?] Value Discount IncVAT ExcVAT TotCost Margin MarginPerc
      // Value is always 7th-from-end; the token before it is MeasuredQty when it
      // ends in "kg", otherwise it's Qty.
      if (cols.length < 9) continue
      productId = cols[0]
      name      = cols[1]
      valueStr  = cols[cols.length - 7] ?? ''
      const t8  = cols[cols.length - 8] ?? ''
      if (/kg$/i.test(t8)) {
        measuredQtyStr = t8
        qtyStr         = cols[cols.length - 9] ?? '0'
      } else {
        measuredQtyStr = ''
        qtyStr         = t8
      }
    } else {
      if (cols.length <= Math.max(col.value, col.measured)) continue
      productId      = cols[col.id]
      name           = cols[col.name]
      valueStr       = cols[col.value]?.trim() ?? ''
      qtyStr         = cols[col.qty]?.trim() ?? '0'
      measuredQtyStr = cols[col.measured]?.trim() ?? ''
    }

    if (!productId || productId.toLowerCase().startsWith('total') || productId === '') continue
    if (!name) continue
    if (!valueStr) continue

    const value = parseFloat(valueStr.replace(/[£,]/g, ''))
    if (isNaN(value) || value <= 0) continue

    const transactionCount = parseInt(qtyStr) || 0

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

  if (rows.length === 0 && errors.length === 0) {
    errors.push(`Couldn't recognise any data rows (${sep}-separated, ${lines.length} lines). Expected the EPOS "Sales by Product" report with ProductID / Name / Qty / MeasuredQty / Value columns.`)
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
