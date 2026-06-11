import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'
import { invoicePdf, type InvoiceExport } from '@/lib/invoice-export'

// SMTP is env-driven. For testing, SMTP_HOST points at the local Mailpit/inbucket
// catch-all (172.20.0.5:1025) — every message lands there, nothing reaches real
// inboxes. For production, swap SMTP_HOST/PORT/USER/PASS for a real provider.
function transport() {
  const host = process.env.SMTP_HOST
  if (!host) throw new Error('Email not configured (SMTP_HOST missing)')
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
}

export async function sendInvoiceEmail(invoiceId: string): Promise<{ to: string }> {
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('wholesale_invoices')
    .select(`
      invoice_number, invoice_date, due_date, total_amount, amount_paid,
      customer:wholesale_customers(name, address, email, account_number),
      items:wholesale_invoice_items(description, quantity, unit_price, total_price)
    `)
    .eq('id', invoiceId)
    .single()
  if (!inv) throw new Error('Invoice not found')

  const c = inv.customer as any
  const to = c?.email
  if (!to) throw new Error('Customer has no email address on file')

  const data: InvoiceExport = {
    invoiceNumber: inv.invoice_number,
    invoiceDate:   inv.invoice_date,
    dueDate:       inv.due_date,
    customer:      { name: c?.name ?? 'Customer', address: c?.address, email: c?.email, accountNumber: c?.account_number },
    items:         ((inv.items as any[]) ?? []).map(i => ({
      description: i.description, quantity: Number(i.quantity), unitPrice: i.unit_price, total: i.total_price,
    })),
    total:         inv.total_amount,
    amountPaid:    inv.amount_paid ?? 0,
  }
  const pdf   = await invoicePdf(data)
  const total = `£${(inv.total_amount / 100).toFixed(2)}`
  const due   = new Date(inv.due_date).toLocaleDateString('en-GB')

  await transport().sendMail({
    from:    process.env.SMTP_FROM ?? 'Fresh & Fruity <invoices@freshandfruity.co.uk>',
    to,
    subject: `Invoice ${inv.invoice_number} from Fresh & Fruity — ${total}`,
    text:    `Dear ${c?.name ?? 'Customer'},\n\nPlease find attached invoice ${inv.invoice_number} for ${total}, due ${due}.\n\nThank you for your business.\n\nFresh & Fruity (GHD) Ltd\n193 Coatsworth Road, Gateshead, NE8 1SR`,
    attachments: [{ filename: `${inv.invoice_number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
  })

  return { to }
}
