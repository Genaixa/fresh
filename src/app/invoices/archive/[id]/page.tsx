import { notFound } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { InvoiceDetail } from './InvoiceDetail'

export interface Delivery {
  ticket_key: string
  ticket_number: string | null
  delivery_date: string | null
  item_count: number
}

export interface ArchiveInvoiceFull {
  id: number
  supplier: string
  doc_type: string
  date: string | null
  invoice_number: string | null
  reference: string | null
  filename: string
}

export default async function ArchiveInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [invRes, deliveriesRes] = await Promise.all([
    fetch(`http://localhost:8000/invoices/${id}`,              { cache: 'no-store' }),
    fetch(`http://localhost:8000/invoices/${id}/deliveries`,   { cache: 'no-store' }),
  ])

  if (!invRes.ok) notFound()

  const invoice: ArchiveInvoiceFull = await invRes.json()
  const deliveriesData = deliveriesRes.ok ? await deliveriesRes.json() : { deliveries: [] }
  const deliveries: Delivery[] = deliveriesData.deliveries ?? []

  return (
    <div className="page pb-24">
      <InvoiceDetail invoice={invoice} deliveries={deliveries} />
      <NavBar />
    </div>
  )
}
