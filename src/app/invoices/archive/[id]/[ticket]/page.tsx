import { notFound } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { DeliveryDetail, type DeliveryItem, type DeliveryInvoice } from './DeliveryDetail'

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ id: string; ticket: string }>
}) {
  const { id, ticket } = await params

  const [invRes, itemsRes] = await Promise.all([
    fetch(`http://localhost:8000/invoices/${id}`,                          { cache: 'no-store' }),
    fetch(`http://localhost:8000/invoices/${id}/deliveries/${ticket}/items`, { cache: 'no-store' }),
  ])

  if (!invRes.ok) notFound()

  const invoice: DeliveryInvoice = await invRes.json()
  const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] }
  const items: DeliveryItem[] = itemsData.items ?? []

  return (
    <div className="page pb-24">
      <DeliveryDetail invoice={invoice} ticketKey={ticket} items={items} />
      <NavBar />
    </div>
  )
}
