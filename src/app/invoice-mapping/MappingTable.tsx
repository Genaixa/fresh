'use client'

import { useState } from 'react'
import { confirmMapping, skipMapping, deleteMapping } from './actions'

type FilterValue = 'pending' | 'confirmed' | 'skipped' | 'all' | 'recent'
type SortKey = 'description' | 'supplier' | 'product'
type SortDir = 'asc' | 'desc'

interface MappingItem {
  id: string
  raw_description: string
  supplier_name: string
  status: string
  product_id: string | null
  unit_type: string | null
  units_per_case: number | null
  box_weight_kg: number | null
  last_price_p: number | null
  appearances: number
}

interface Product {
  id: string
  name: string
  epos_now_id: string | null
}

interface Props {
  items: MappingItem[]
  catalogue: Product[]
  suggestions: Record<string, string | null>
  recentRaws?: string[]
  focusRecent?: boolean
}

const COLS = '2.5fr 0.6fr 1.8fr 1fr 0.75fr 0.6fr 1fr 120px'

const SUPPLIER_SHORT: Record<string, string> = {
  'dole wholesale gateshead': 'Dole',
  'jr holland':               'Holland',
}

const PAGE_SIZES = [10, 20, 50]

export function MappingTable({ items, catalogue, suggestions, recentRaws = [], focusRecent = false }: Props) {
  const recentSet = new Set(recentRaws.map(r => r.toLowerCase()))
  const isRecent  = (i: MappingItem) => recentSet.has(i.raw_description.toLowerCase())
  const recentCount = items.filter(i => i.status === 'pending' && isRecent(i)).length
  // Arriving from the dashboard's "needs mapping" nudge → focus the recent arrivals
  // (the ones it was counting), not the whole backlog. Falls back to pending if none.
  const [filter,   setFilter]   = useState<FilterValue>(focusRecent && recentCount > 0 ? 'recent' : 'pending')
  const [sort,     setSort]     = useState<{ key: SortKey; dir: SortDir }>({ key: 'description', dir: 'asc' })
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const productName = (id: string | null) =>
    id ? (catalogue.find(p => p.id === id)?.name ?? '') : ''

  function toggleSort(key: SortKey) {
    setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }

  function changeFilter(f: FilterValue) {
    setFilter(f)
    setPage(1)
  }

  const counts = {
    pending:   items.filter(i => i.status === 'pending').length,
    confirmed: items.filter(i => i.status === 'confirmed').length,
    skipped:   items.filter(i => i.status === 'skipped').length,
    all:       items.length,
  }

  const filtered = items.filter(i => {
    if (filter === 'all')    return true
    if (filter === 'recent') return i.status === 'pending' && isRecent(i)
    return i.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = 0
    let bv: string | number = 0
    switch (sort.key) {
      case 'description': av = a.raw_description; bv = b.raw_description; break
      case 'supplier':    av = a.supplier_name;   bv = b.supplier_name;   break
      case 'product':
        av = productName(suggestions[a.id] ?? a.product_id ?? null)
        bv = productName(suggestions[b.id] ?? b.product_id ?? null)
        break
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageItems  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const thClass = 'text-sm font-semibold text-gray-500 select-none whitespace-nowrap px-2 py-2 border-b border-gray-200'

  function Th({ label, col }: { label: string; col?: SortKey }) {
    const active = col && sort.key === col
    return (
      <div
        onClick={col ? () => toggleSort(col) : undefined}
        className={`${thClass} ${col ? 'cursor-pointer hover:text-gray-900 transition-colors' : ''}`}
      >
        {label}
        {col && <span className="ml-1 opacity-40">{active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>}
      </div>
    )
  }

  return (
    <div>
      {/* Filter tiles */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {([
          { value: 'pending',   label: 'Pending',   active: 'bg-red-50 border-red-300 text-red-600'         },
          { value: 'confirmed', label: 'Confirmed',  active: 'bg-green-50 border-green-400 text-green-700'   },
          { value: 'skipped',   label: 'Skipped',    active: 'bg-gray-100 border-gray-400 text-gray-700'     },
          { value: 'all',       label: 'All',        active: 'bg-blue-50 border-blue-400 text-blue-700'      },
        ] as const).map(t => (
          <button
            key={t.value}
            onClick={() => changeFilter(t.value)}
            className={`rounded-xl border py-3 text-center transition-all
              ${filter === t.value ? t.active + ' font-bold' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
          >
            <div className="text-2xl font-bold leading-none">{counts[t.value]}</div>
            <div className="text-sm mt-1 opacity-80">{t.label}</div>
          </button>
        ))}
      </div>

      {filter === 'recent' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300
                        bg-amber-50 px-4 py-3 text-sm">
          <span className="text-amber-800">
            Showing <b>{recentCount}</b> {recentCount === 1 ? 'product' : 'products'} from recent deliveries — what the dashboard flagged.
          </span>
          <button onClick={() => changeFilter('pending')}
            className="font-semibold text-amber-800 underline whitespace-nowrap">
            Show all {counts.pending} pending
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-3xl mb-3">✓</p>
          <p className="font-medium text-gray-700">{filter === 'pending' ? 'Nothing left to map!' : 'Nothing here'}</p>
        </div>
      ) : (
        <>
          {/* Pagination top bar */}
          <div className="flex items-center justify-between mb-3 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span>Per page</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
                  className={`px-2 py-1 rounded ${pageSize === s ? 'bg-brand-accent text-white font-bold' : 'border border-gray-300 text-gray-600'}`}>
                  {s}
                </button>
              ))}
            </div>
            <span>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}</span>
          </div>

          {/* Single flat grid — header + rows share one grid so columns align perfectly */}
          <div className="w-full grid" style={{ gridTemplateColumns: COLS }}>

            {/* Header row — 8 cells */}
            <Th label="Description" col="description" />
            <Th label="Supplier"    col="supplier"    />
            <Th label="Product"     col="product"     />
            <Th label="Sold by"                       />
            <Th label="kg"                            />
            <Th label="units"                         />
            <Th label="EPOS ID"                       />
            <div className={thClass} />

            {/* Data rows — each form is display:contents so its cells join the same grid */}
            {pageItems.map(item => {
              const resolvedId = suggestions[item.id] ?? item.product_id ?? null
              const eposId     = catalogue.find(p => p.id === resolvedId)?.epos_now_id ?? null
              return (
                <MappingRow
                  key={item.id}
                  item={item}
                  catalogue={catalogue}
                  suggestedProductId={resolvedId}
                  supplierShort={SUPPLIER_SHORT[item.supplier_name] ?? item.supplier_name}
                  eposId={eposId}
                  recent={isRecent(item)}
                />
              )
            })}
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30">
              ← Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-sm ${
                        p === safePage ? 'bg-brand-accent text-white font-bold' : 'text-gray-400 hover:text-gray-900'
                      }`}>
                      {p}
                    </button>
                  )
                )}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30">
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Cell base class shared by all data cells
const tdClass = 'px-2 py-2 border-b border-gray-100 text-sm flex items-center'

function MappingRow({ item, catalogue, suggestedProductId, supplierShort, eposId, recent }: {
  item: MappingItem
  catalogue: Product[]
  suggestedProductId: string | null
  supplierShort: string
  eposId: string | null
  recent?: boolean
}) {
  const defaultUnitType: 'weight' | 'count' =
    item.unit_type === 'weight' ? 'weight' :
    item.unit_type === 'count'  ? 'count'  :
    item.box_weight_kg          ? 'weight' : 'count'

  const dimClass =
    item.status === 'confirmed' ? 'opacity-40 hover:opacity-100' :
    item.status === 'skipped'   ? 'opacity-25 hover:opacity-60'  : ''

  return (
    <form action={confirmMapping} style={{ display: 'contents' }} className={dimClass}>
      <input type="hidden" name="id" value={item.id} />

      <div className={`${tdClass} font-mono break-all leading-snug text-gray-800
        ${recent ? 'border-l-4 border-amber-400 bg-amber-50/60 pl-2' : ''}`}>{item.raw_description}</div>
      <div className={`${tdClass} text-gray-400`}>{supplierShort}</div>

      <div className={tdClass}>
        <select name="product_id" required
          defaultValue={suggestedProductId ?? ''}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-accent">
          <option value="" disabled>— select —</option>
          {catalogue.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className={`${tdClass} flex-col gap-0.5 items-start`}>
        <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-gray-700">
          <input type="radio" name="unit_type" value="weight"
            defaultChecked={defaultUnitType === 'weight'} className="accent-brand-accent" />
          kg
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-gray-700">
          <input type="radio" name="unit_type" value="count"
            defaultChecked={defaultUnitType === 'count'} className="accent-brand-accent" />
          units
        </label>
      </div>

      <div className={tdClass}>
        <input type="number" name="box_weight_kg" placeholder="kg"
          step="0.01" min="0.01" defaultValue={item.box_weight_kg ?? ''}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div className={tdClass}>
        <input type="number" name="units_per_case" placeholder="qty"
          step="1" min="1" defaultValue={item.units_per_case ?? ''}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div className={tdClass}>
        <input type="text" name="epos_now_id" placeholder="EPOS ID"
          defaultValue={eposId ?? ''}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div className={`${tdClass} gap-1`}>
        <button type="submit"
          className="bg-brand-accent text-white text-sm px-2.5 py-1.5 rounded-lg font-bold shrink-0">
          ✓
        </button>
        <button type="submit" formAction={skipMapping}
          className="text-gray-400 text-sm px-2 py-1.5 rounded-lg border border-gray-200 shrink-0">
          –
        </button>
        <button type="submit" formAction={deleteMapping} formNoValidate
          onClick={e => { if (!confirm('Delete this mapping?')) e.preventDefault() }}
          className="text-red-500 text-sm px-2 py-1.5 rounded-lg border border-red-200 shrink-0">
          ✕
        </button>
      </div>
    </form>
  )
}
