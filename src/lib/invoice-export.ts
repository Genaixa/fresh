import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Business header (no settings table yet — hardcoded; produce is zero-rated, no VAT).
const BUSINESS = {
  name: 'Fresh & Fruity (GHD) Ltd',
  lines: ['193 Coatsworth Road', 'Gateshead', 'Tyne & Wear', 'NE8 1SR'],
}

export type InvoiceExport = {
  invoiceNumber: string
  invoiceDate:   string
  dueDate:       string
  customer:      { name: string; address?: string | null; email?: string | null; accountNumber?: string | null }
  items:         { description: string; quantity: number; unitPrice: number; total: number }[]
  total:         number
  amountPaid:    number
}

const gbp = (p: number) => `£${(p / 100).toFixed(2)}`
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export async function invoicePdf(d: InvoiceExport): Promise<Uint8Array> {
  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595, H = 842, M = 50
  let page = pdf.addPage([W, H])

  const t = (s: string, x: number, y: number, size = 10, f = font, c = rgb(0.12, 0.12, 0.12)) =>
    page.drawText(s, { x, y, size, font: f, color: c })
  const tr = (s: string, xRight: number, y: number, size = 10, f = font, c = rgb(0.12, 0.12, 0.12)) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color: c })
  const line = (y: number) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rgb(0.8, 0.8, 0.8) })

  let y = H - 60
  // Header
  t(BUSINESS.name, M, y, 16, bold)
  tr('INVOICE', W - M, y, 20, bold)
  tr(d.invoiceNumber, W - M, y - 18, 11, bold)
  let by = y - 18
  for (const l of BUSINESS.lines) { t(l, M, by, 9, font, rgb(0.45, 0.45, 0.45)); by -= 12 }

  // Dates + Bill to
  y = by - 24
  tr('Invoice date: ' + fmtDate(d.invoiceDate), W - M, y, 9, font, rgb(0.35, 0.35, 0.35))
  tr('Due: ' + fmtDate(d.dueDate), W - M, y - 12, 9, font, rgb(0.35, 0.35, 0.35))
  t('BILL TO', M, y, 9, bold, rgb(0.45, 0.45, 0.45)); y -= 15
  t(d.customer.name, M, y, 12, bold); y -= 13
  if (d.customer.accountNumber) { t('Account ' + d.customer.accountNumber, M, y, 9, font, rgb(0.45, 0.45, 0.45)); y -= 11 }
  for (const l of (d.customer.address ?? '').split('\n').filter(Boolean)) { t(l, M, y, 9); y -= 11 }
  if (d.customer.email) { t(d.customer.email, M, y, 9, font, rgb(0.45, 0.45, 0.45)); y -= 11 }

  // Table
  y -= 22
  const cQty = 360, cUnit = 450, cTot = W - M
  t('Description', M, y, 9, bold); tr('Qty', cQty, y, 9, bold); tr('Unit', cUnit, y, 9, bold); tr('Total', cTot, y, 9, bold)
  y -= 6; line(y); y -= 16
  for (const it of d.items) {
    if (y < 90) { page = pdf.addPage([W, H]); y = H - 60 }
    t(it.description.slice(0, 48), M, y, 10)
    tr(String(it.quantity), cQty, y, 10)
    tr(gbp(it.unitPrice), cUnit, y, 10)
    tr(gbp(it.total), cTot, y, 10)
    y -= 16
  }
  // Total
  y -= 4; page.drawLine({ start: { x: 360, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.75, color: rgb(0.8, 0.8, 0.8) })
  tr('Total', cUnit, y - 8, 12, bold); tr(gbp(d.total), cTot, y - 8, 12, bold)
  if (d.amountPaid > 0) {
    tr('Paid', cUnit, y - 26, 9); tr(gbp(d.amountPaid), cTot, y - 26, 9)
    tr('Balance due', cUnit, y - 40, 10, bold); tr(gbp(d.total - d.amountPaid), cTot, y - 40, 10, bold)
  }
  // Footer
  t('Fresh produce is zero-rated for VAT.   Thank you for your business.', M, 45, 8, font, rgb(0.55, 0.55, 0.55))

  return await pdf.save()
}

export function invoiceCsv(d: InvoiceExport): string {
  const esc = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  const rows: string[][] = [
    ['Invoice', d.invoiceNumber],
    ['Date', fmtDate(d.invoiceDate)],
    ['Due', fmtDate(d.dueDate)],
    ['Customer', d.customer.name],
    ['Account', d.customer.accountNumber ?? ''],
    [],
    ['Description', 'Qty', 'Unit price (£)', 'Total (£)'],
    ...d.items.map(i => [i.description, String(i.quantity), (i.unitPrice / 100).toFixed(2), (i.total / 100).toFixed(2)]),
    [],
    ['', '', 'Total (£)', (d.total / 100).toFixed(2)],
  ]
  // Lead with a UTF-8 BOM so Excel reads £ (and any non-ASCII) as UTF-8 rather
  // than Windows-1252, which otherwise renders "£" as "Â£".
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\n')
}
