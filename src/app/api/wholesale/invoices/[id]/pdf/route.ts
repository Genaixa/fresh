import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

// Generates an HTML invoice that prints cleanly, then returned as HTML
// We use HTML-to-print rather than a PDF library to avoid large bundle size on edge
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: inv, error } = await supabase
    .from('wholesale_invoices')
    .select(`
      *,
      customer:wholesale_customers(*),
      items:wholesale_invoice_items(*)
    `)
    .eq('id', id)
    .single()

  if (error || !inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const customer = inv.customer as any
  const items    = (inv.items ?? []) as any[]
  const balance  = inv.total_amount - inv.amount_paid

  const rows = items.map((i: any) => `
    <tr>
      <td>${i.description}</td>
      <td class="num">${i.quantity}</td>
      <td class="num">${pence(i.unit_price)}</td>
      <td class="num">${pence(i.total_price)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${inv.invoice_number} – Fresh &amp; Fruity</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; padding: 40px; max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 22px; font-weight: bold; color: #2D5F2D; }
  .brand-sub { color: #666; font-size: 12px; margin-top: 4px; }
  .inv-meta { text-align: right; }
  .inv-number { font-size: 20px; font-weight: bold; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .addresses { display: flex; gap: 40px; margin-bottom: 32px; }
  .address p { font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead { background: #f5f5f5; }
  th { padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  .num { text-align: right; }
  .totals { margin-left: auto; width: 260px; }
  .totals td { padding: 6px 12px; font-size: 14px; }
  .totals .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #2D5F2D; padding-top: 10px; color: #2D5F2D; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
  .paid-stamp { display: inline-block; border: 3px solid #2D5F2D; color: #2D5F2D; padding: 6px 20px; border-radius: 6px; font-weight: bold; font-size: 18px; transform: rotate(-8deg); margin: 16px 0; }
  @media print { body { padding: 20px; } button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Fresh &amp; Fruity</div>
    <div class="brand-sub">193 Coatsworth Road, Bensham<br>Gateshead NE8 1SR<br>Tel: 0191 XXX XXXX</div>
  </div>
  <div class="inv-meta">
    <div class="inv-number">${inv.invoice_number}</div>
    <div style="color:#666;font-size:13px;margin-top:6px;">Invoice date: ${fmtDate(inv.invoice_date)}</div>
    <div style="color:#666;font-size:13px;">Due: ${fmtDate(inv.due_date)}</div>
  </div>
</div>

<div class="addresses">
  <div class="address">
    <p class="section-title">Bill to</p>
    <p><strong>${customer.name}</strong></p>
    ${customer.contact_name ? `<p>${customer.contact_name}</p>` : ''}
    ${customer.address ? `<p>${customer.address.replace(/\n/g, '<br>')}</p>` : ''}
    ${customer.email ? `<p>${customer.email}</p>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<table class="totals">
  <tr>
    <td>Subtotal</td>
    <td class="num">${pence(inv.total_amount)}</td>
  </tr>
  ${inv.amount_paid > 0 ? `
  <tr>
    <td>Paid</td>
    <td class="num" style="color:#2D5F2D">−${pence(inv.amount_paid)}</td>
  </tr>` : ''}
  <tr class="total-row">
    <td>Balance due</td>
    <td class="num">${pence(balance)}</td>
  </tr>
</table>

${inv.payment_status === 'paid' ? '<div style="text-align:center"><span class="paid-stamp">PAID</span></div>' : ''}

${inv.notes ? `<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:6px;font-size:13px;color:#555">${inv.notes}</div>` : ''}

<div class="footer">
  <p>Fresh &amp; Fruity · 193 Coatsworth Road, Bensham, Gateshead NE8 1SR</p>
  <p style="margin-top:4px">Please include invoice number ${inv.invoice_number} with your payment</p>
</div>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
