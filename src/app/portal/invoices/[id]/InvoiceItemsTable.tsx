'use client'

import { useState } from 'react'

export type InvoiceItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

type SortKey = 'description' | 'quantity' | 'unit_price' | 'total_price'

function pence(p: number) { return `£${(p / 100).toFixed(2)}` }

export default function InvoiceItemsTable({ items }: { items: InvoiceItem[] }) {
  // null = original document order (matches the PDF) until a header is clicked.
  const [sort, setSort] = useState<SortKey | null>(null)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const rows = sort === null ? items : [...items].sort((a, b) => {
    const cmp =
      sort === 'description'
        ? a.description.localeCompare(b.description)
        : a[sort] - b[sort]
    return dir === 'asc' ? cmp : -cmp
  })

  function toggle(key: SortKey) {
    if (key === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir(key === 'description' ? 'asc' : 'desc') }
  }
  const arrow = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '')

  const headCls = 'text-[var(--text-muted)] text-xs font-medium whitespace-nowrap'
  const btnCls = 'inline-flex items-center hover:text-[var(--text)] transition-colors'

  return (
    <div className="card p-0 overflow-hidden mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className={`${headCls} px-3 py-2`}>
              <button className={btnCls} onClick={() => toggle('description')} aria-label="Sort by item">
                Item{arrow('description')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('quantity')} aria-label="Sort by quantity">
                Qty{arrow('quantity')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right hidden sm:table-cell`}>
              <button className={btnCls} onClick={() => toggle('unit_price')} aria-label="Sort by unit price">
                Unit{arrow('unit_price')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('total_price')} aria-label="Sort by line total">
                Total{arrow('total_price')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(item => (
            <tr key={item.id} className="border-b border-zinc-800 last:border-0">
              <td className="px-3 py-2.5 font-medium">{item.description}</td>
              <td className="px-3 py-2.5 text-right text-[var(--text-muted)] whitespace-nowrap">{item.quantity}</td>
              <td className="px-3 py-2.5 text-right text-[var(--text-muted)] whitespace-nowrap hidden sm:table-cell">
                {pence(item.unit_price)}
              </td>
              <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{pence(item.total_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
