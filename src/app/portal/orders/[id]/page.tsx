import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import OrderItemsTable from './OrderItemsTable'

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }

// Customer-facing order / delivery note. Deliberately shows NO prices — the
// portal never exposes commercial figures; pricing arrives on the invoice.
const STATUS: Record<string, { label: string; pill: string }> = {
  confirmed:  { label: 'Awaiting delivery', pill: 'bg-blue-900 text-blue-300' },
  dispatched: { label: 'Delivered',         pill: 'bg-green-900 text-green-300' },
  cancelled:  { label: 'Cancelled',         pill: 'bg-zinc-700 text-zinc-400' },
}

export default async function PortalOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/portal')

  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id')
    .eq('portal_user_id', user.id)
    .single()
  if (!customer) redirect('/portal')

  const { data: order } = await supabase
    .from('wholesale_orders')
    .select('id, order_date, delivery_date, status, notes, placed_by_name, items:wholesale_order_items(id, quantity, unit_type, product:products(name, unit))')
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single()

  if (!order || order.status === 'draft') notFound()

  const meta = STATUS[order.status] ?? { label: order.status, pill: 'bg-zinc-700 text-zinc-300' }
  const isDelivered = order.status === 'dispatched'
  const unitLabel = (it: { unit_type: string; product: { unit?: string } | null }) =>
    it.unit_type === 'box' ? 'box' : (it.product?.unit ?? 'each')

  return (
    <div className="page pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/portal" className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">{isDelivered ? 'Delivery note' : 'Order'}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${meta.pill}`}>{meta.label}</span>
      </div>

      <div className="card mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[var(--text-muted)] text-xs">Order date</p>
          <p>{fmtDate(order.order_date)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">{isDelivered ? 'Delivered' : 'Delivery date'}</p>
          <p>{order.delivery_date ? fmtDate(order.delivery_date) : '—'}</p>
        </div>
        {order.placed_by_name && (
          <div>
            <p className="text-[var(--text-muted)] text-xs">Ordered by</p>
            <p>{order.placed_by_name}</p>
          </div>
        )}
      </div>

      {(order.items ?? []).length > 0 ? (
        <OrderItemsTable
          items={(order.items as any[]).map(it => ({
            id: it.id,
            name: it.product?.name ?? 'Item',
            quantity: Number(it.quantity),
            unit: unitLabel(it),
          }))}
        />
      ) : (
        <div className="card text-center py-6 text-[var(--text-muted)] mb-4">No items</div>
      )}

      {order.notes && (
        <div className="card mb-4 text-sm">
          <p className="text-[var(--text-muted)] text-xs mb-1">Your note</p>
          <p className="whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      <p className="text-[var(--text-muted)] text-xs text-center">
        {isDelivered
          ? 'Prices will appear on your invoice once this delivery is invoiced.'
          : 'This order is with David. To change it, call or text him.'}
      </p>

      <div className="mt-6 text-center text-[var(--text-muted)] text-xs">
        <p>Fresh &amp; Fruity · 193 Coatsworth Road, Gateshead NE8 1SR</p>
      </div>
    </div>
  )
}
