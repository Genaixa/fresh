'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type OrderKind = 'pending' | 'delivered' | 'cancelled'

export type PortalOrder = {
  id: string
  order_date: string
  delivery_date: string | null
  kind: OrderKind
  count: number
}

type SortKey = 'type' | 'date' | 'count' | 'status'

const PILL: Record<OrderKind, string> = {
  pending:   'bg-blue-900 text-blue-300',
  delivered: 'bg-green-900 text-green-300',
  cancelled: 'bg-zinc-700 text-zinc-400',
}
const STATUS_LABEL: Record<OrderKind, string> = {
  pending: 'Awaiting delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB') }
function fmtDayMonth(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const typeLabel = (k: OrderKind) => (k === 'delivered' ? 'Delivery note' : 'Order')
const headlineDate = (o: PortalOrder) =>
  o.kind === 'delivered' ? (o.delivery_date ?? o.order_date) : o.order_date

export default function OrderTable({
  rows,
  initialSort = 'date',
  initialDir = 'desc',
}: {
  rows: PortalOrder[]
  initialSort?: SortKey
  initialDir?: 'asc' | 'desc'
}) {
  const router = useRouter()
  const [sort, setSort] = useState<SortKey>(initialSort)
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir)

  const sorted = [...rows].sort((a, b) => {
    let cmp: number
    if (sort === 'count') cmp = a.count - b.count
    else if (sort === 'date') cmp = headlineDate(a).localeCompare(headlineDate(b))
    else if (sort === 'type') cmp = typeLabel(a.kind).localeCompare(typeLabel(b.kind))
    else cmp = STATUS_LABEL[a.kind].localeCompare(STATUS_LABEL[b.kind])
    return dir === 'asc' ? cmp : -cmp
  })

  function toggle(key: SortKey) {
    if (key === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir(key === 'date' ? 'desc' : 'asc') }
  }
  const arrow = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '')

  const headCls = 'text-[var(--text-muted)] text-xs font-medium whitespace-nowrap'
  const btnCls = 'inline-flex items-center hover:text-[var(--text)] transition-colors'

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className={`${headCls} px-3 py-2 hidden sm:table-cell`}>
              <button className={btnCls} onClick={() => toggle('type')} aria-label="Sort by type">
                Type{arrow('type')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2`}>
              <button className={btnCls} onClick={() => toggle('date')} aria-label="Sort by date">
                Date{arrow('date')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('count')} aria-label="Sort by item count">
                Items{arrow('count')}
              </button>
            </th>
            <th className={`${headCls} px-3 py-2 text-right`}>
              <button className={btnCls} onClick={() => toggle('status')} aria-label="Sort by status">
                Status{arrow('status')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr
              key={o.id}
              onClick={() => router.push(`/portal/orders/${o.id}`)}
              className="border-b border-zinc-800 last:border-0 cursor-pointer hover:bg-zinc-800/50 transition-colors"
            >
              <td className="px-3 py-2.5 font-semibold whitespace-nowrap hidden sm:table-cell">
                {typeLabel(o.kind)}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-semibold sm:font-normal">{fmtDate(headlineDate(o))}</span>
                {o.kind === 'pending' && o.delivery_date && (
                  <span className="text-[var(--text-muted)] text-xs">{` · for ${fmtDayMonth(o.delivery_date)}`}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--text-muted)] whitespace-nowrap">{o.count}</td>
              <td className="px-3 py-2.5 text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PILL[o.kind]}`}>
                  {STATUS_LABEL[o.kind]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
