'use client'

import { useState } from 'react'

export type OrderItem = {
  id: string
  name: string
  quantity: number
  unit: string
}

type SortKey = 'name' | 'quantity' | 'unit'

// Mirrors the invoice InvoiceItemsTable, minus prices — the portal never shows
// commercial figures on an order. null sort = original order until a header tap.
export default function OrderItemsTable({ items }: { items: OrderItem[] }) {
  const [sort, setSort] = useState<SortKey | null>(null)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const rows = sort === null ? items : [...items].sort((a, b) => {
    const cmp = sort === 'quantity' ? a.quantity - b.quantity : String(a[sort]).localeCompare(String(b[sort]))
    return dir === 'asc' ? cmp : -cmp
  })

  function toggle(key: SortKey) {
    if (key === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir(key === 'quantity' ? 'desc' : 'asc') }
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
              <button className={btnCls} onClick={() => toggle('name')} aria-label="Sort by item">
                Item{arrow('name')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('quantity')} aria-label="Sort by quantity">
                Qty{arrow('quantity')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('unit')} aria-label="Sort by unit">
                Unit{arrow('unit')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(it => (
            <tr key={it.id} className="border-b border-zinc-800 last:border-0">
              <td className="px-3 py-2.5 font-medium">{it.name}</td>
              <td className="px-3 py-2.5 text-right text-[var(--text-muted)] whitespace-nowrap">{it.quantity}</td>
              <td className="px-3 py-2.5 text-right text-[var(--text-muted)] whitespace-nowrap">{it.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
