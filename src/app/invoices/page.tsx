import { NavBar } from '@/components/ui/NavBar'
import Link from 'next/link'
import { InvoicesClient } from './InvoicesClient'

export interface ArchiveInvoice {
  id: number
  supplier: string
  doc_type: string
  date: string | null
  invoice_number: string | null
  reference: string | null
  filename: string
}

export default async function InvoicesPage() {
  let invoices: ArchiveInvoice[] = []

  try {
    const res = await fetch('http://localhost:8000/invoices?limit=1000', {
      cache: 'no-store',
    })
    const data = await res.json()
    invoices = data.results ?? []
  } catch {
    // API unreachable — show empty state
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary px-4 py-2 text-sm min-h-[40px]">
          + Upload
        </Link>
      </div>
      <InvoicesClient invoices={invoices} />
      <NavBar />
    </div>
  )
}
