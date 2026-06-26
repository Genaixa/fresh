/**
 * Resolve a parsed invoice to one of the shop's canonical supplier names.
 * Priority of signals, most reliable first:
 *   1. FOOTER VAT registration number — unique per company, immune to the
 *      misleading "Devorah Grynavs" account name printed in the header.
 *   2. Document number pattern (ticket / delivery-note numbering).
 *   3. Header / letterhead text words (last resort).
 * Shared by the autopilot webhook (/api/delivery-note) and manual upload
 * (/api/invoices/upload) so both attribute identically.
 */

/** VAT reg (digits only) → supplier. Seed from observed footers; extend as new
 *  suppliers' notes come in. Baty notes are "NOT a VAT invoice" (no reg). */
export function supplierFromVatReg(vat: string | null | undefined): string | null {
  if (!vat) return null
  const v = vat.replace(/[^0-9]/g, '')
  if (v === '746966868') return 'JR Holland'      // J.R. Holland
  if (v === '896567842') return 'Total Produce'   // Redbridge / Dole Wholesale Gateshead (GB 896 5678 42)
  return null
}

/** Document-number pattern → supplier. */
export function supplierFromNumber(num: string | null | undefined): string | null {
  if (!num) return null
  const n = num.trim()
  if (/^(DN|WI)/i.test(n)) return 'Thomas Baty'
  if (/^27\d{5}$/.test(n)) return 'JR Holland'
  if (/^112\d{5}$/.test(n)) return 'Total Produce'
  if (/^20\d{3}$/.test(n)) return 'The Milk Company'  // weekly milk invoice no. e.g. 20019
  return null
}

/** Header/letterhead text → supplier (fallback). */
export function supplierFromHeader(raw: string | null | undefined): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('holland') || lower.includes('devorah')) return 'JR Holland'
  if (lower.includes('baty')) return 'Thomas Baty'
  if (lower.includes('dole') || lower.includes('redbridge') || lower.includes('gateshead') || lower.includes('total produce')) return 'Total Produce'
  if (lower.includes('milk')) return 'The Milk Company'
  return raw ?? 'Unknown'
}

export function resolveSupplierName(parsed: {
  supplier_vat_reg: string | null
  invoice_number: string | null
  supplier_name: string
}): string {
  return (
    supplierFromVatReg(parsed.supplier_vat_reg) ??
    supplierFromNumber(parsed.invoice_number) ??
    supplierFromHeader(parsed.supplier_name)
  )
}
