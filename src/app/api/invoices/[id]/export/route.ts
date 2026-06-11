import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { invoicePdf, invoiceCsv, type InvoiceExport } from '@/lib/invoice-export'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'pdf'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: inv } = await supabase
    .from('wholesale_invoices')
    .select(`
      invoice_number, invoice_date, due_date, total_amount, amount_paid,
      customer:wholesale_customers(name, address, email, account_number),
      items:wholesale_invoice_items(description, quantity, unit_price, total_price)
    `)
    .eq('id', id)
    .single()

  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const c = inv.customer as any
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

  if (format === 'csv') {
    return new NextResponse(invoiceCsv(data), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${inv.invoice_number}.csv"`,
      },
    })
  }

  const pdf = await invoicePdf(data)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${inv.invoice_number}.pdf"`,
    },
  })
}
