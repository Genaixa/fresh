import { createClient } from '@/lib/supabase/server'
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleInvoice,
  WholesaleOrderItem,
  CustomerBalance,
} from '@/types'

export function formatInvoiceNumber(seq: number, year: number): string {
  return `INV-${year}-${String(seq).padStart(3, '0')}`
}

export async function generateInvoiceFromOrder(orderId: string): Promise<WholesaleInvoice> {
  const supabase = await createClient()

  // Load order + items + customer
  const { data: order, error: orderErr } = await supabase
    .from('wholesale_orders')
    .select(`
      *,
      customer:wholesale_customers(*),
      items:wholesale_order_items(*, product:products(name, unit))
    `)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) throw new Error('Order not found')
  if (order.status === 'dispatched') throw new Error('Invoice already generated for this order')

  const customer = order.customer as WholesaleCustomer
  const items    = order.items as (WholesaleOrderItem & { product: { name: string; unit: string } })[]

  // Calculate totals
  const subtotal = items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price), 0)

  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('wholesale_invoices')
    .select('*', { count: 'exact', head: true })
    .ilike('invoice_number', `INV-${year}-%`)
  const seq = (count ?? 0) + 1

  const invoiceNumber = formatInvoiceNumber(seq, year)
  const invoiceDate   = new Date().toISOString().split('T')[0]
  const dueDate       = new Date(Date.now() + customer.payment_terms * 86400000)
    .toISOString()
    .split('T')[0]

  // Create invoice
  const { data: invoice, error: invErr } = await supabase
    .from('wholesale_invoices')
    .insert({
      customer_id:    customer.id,
      order_id:       orderId,
      invoice_number: invoiceNumber,
      invoice_date:   invoiceDate,
      due_date:       dueDate,
      subtotal,
      total_amount:   subtotal,
    })
    .select()
    .single()

  if (invErr || !invoice) throw new Error('Failed to create invoice: ' + invErr?.message)

  // Create invoice line items (snapshot)
  const lineItems = items.map(i => ({
    invoice_id:  invoice.id,
    product_id:  i.product_id,
    description: i.product?.name ?? 'Unknown',
    quantity:    i.quantity,
    unit_price:  i.unit_price,
    total_price: Math.round(i.quantity * i.unit_price),
  }))

  await supabase.from('wholesale_invoice_items').insert(lineItems)

  // Mark order as dispatched
  await supabase
    .from('wholesale_orders')
    .update({ status: 'dispatched' })
    .eq('id', orderId)

  return invoice as WholesaleInvoice
}

export async function getCustomerBalances(): Promise<CustomerBalance[]> {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('wholesale_customers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (!customers?.length) return []

  // Mark overdue
  await supabase.rpc('mark_overdue_invoices')

  const { data: invoices } = await supabase
    .from('wholesale_invoices')
    .select('customer_id, total_amount, amount_paid, payment_status, due_date')

  const balances: CustomerBalance[] = customers.map(c => {
    const cInvoices = (invoices ?? []).filter(i => i.customer_id === c.id)
    const total_invoiced = cInvoices.reduce((s, i) => s + i.total_amount, 0)
    const total_paid     = cInvoices.reduce((s, i) => s + i.amount_paid, 0)
    const overdue_amount = cInvoices
      .filter(i => i.payment_status === 'overdue')
      .reduce((s, i) => s + (i.total_amount - i.amount_paid), 0)

    return {
      customer:       c as WholesaleCustomer,
      total_invoiced,
      total_paid,
      balance_due:    total_invoiced - total_paid,
      overdue_amount,
      invoice_count:  cInvoices.length,
    }
  })

  return balances
}
