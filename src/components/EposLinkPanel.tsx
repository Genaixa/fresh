'use client'

import { useState, useCallback } from 'react'

interface ProductRow {
  id: string
  name: string
  category: string
  epos_now_id: string | null
}

type Filter = 'all' | 'unlinked' | 'linked'

export function EposLinkPanel({ products }: { products: ProductRow[] }) {
  const [rows, setRows]       = useState<ProductRow[]>(products)
  const [filter, setFilter]   = useState<Filter>('unlinked')
  const [saving, setSaving]   = useState<Record<string, boolean>>({})
  const [saved, setSaved]     = useState<Record<string, boolean>>({})
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [open, setOpen]       = useState(true)

  const linked   = rows.filter(r => r.epos_now_id?.trim())
  const unlinked = rows.filter(r => !r.epos_now_id?.trim())

  const visible = filter === 'linked'   ? linked
                : filter === 'unlinked' ? unlinked
                : rows

  const saveRow = useCallback(async (productId: string, value: string) => {
    const trimmed = value.trim()
    setSaving(s => ({ ...s, [productId]: true }))
    setSaved(s => ({ ...s, [productId]: false }))
    setErrors(e => ({ ...e, [productId]: '' }))

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epos_now_id: trimmed || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setRows(rs => rs.map(r => r.id === productId ? { ...r, epos_now_id: trimmed || null } : r))
      setSaved(s => ({ ...s, [productId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [productId]: false })), 2000)
    } catch (err: any) {
      setErrors(e => ({ ...e, [productId]: err.message }))
    } finally {
      setSaving(s => ({ ...s, [productId]: false }))
    }
  }, [])

  return (
    <div className="card">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between min-h-[44px]"
      >
        <div className="text-left">
          <p className="font-semibold">EPOS Now product IDs</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {linked.length} of {rows.length} products linked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pill */}
          <span className={`text-xs px-2 py-1 rounded-full font-medium
            ${linked.length === rows.length
              ? 'bg-green-900 text-green-300'
              : unlinked.length > 0
              ? 'bg-yellow-900 text-yellow-300'
              : 'bg-zinc-700 text-zinc-300'}`}>
            {linked.length}/{rows.length}
          </span>
          <span className="text-[var(--text-muted)] text-lg">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 mt-4 mb-3">
            {(['unlinked', 'linked', 'all'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === f
                    ? 'bg-brand-accent text-white'
                    : 'bg-white/5 text-[var(--text-muted)]'}`}
              >
                {f === 'unlinked' ? `Unlinked (${unlinked.length})`
                 : f === 'linked' ? `Linked (${linked.length})`
                 : `All (${rows.length})`}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-4">
              {filter === 'unlinked' ? 'All products are linked' : 'No products linked yet'}
            </p>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {visible.map(row => (
                <ProductIdRow
                  key={row.id}
                  row={row}
                  isSaving={saving[row.id] ?? false}
                  isSaved={saved[row.id] ?? false}
                  error={errors[row.id] ?? ''}
                  onSave={saveRow}
                />
              ))}
            </div>
          )}

          <p className="text-[var(--text-muted)] text-xs mt-3">
            Enter the SKU (e.g. FF-001) from the product catalogue spreadsheet.
            Changes save automatically when you leave the field.
          </p>
        </>
      )}
    </div>
  )
}

function ProductIdRow({
  row,
  isSaving,
  isSaved,
  error,
  onSave,
}: {
  row: ProductRow
  isSaving: boolean
  isSaved: boolean
  error: string
  onSave: (id: string, value: string) => void
}) {
  const [value, setValue] = useState(row.epos_now_id ?? '')
  const isLinked = !!row.epos_now_id?.trim()

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg
      ${isLinked ? 'bg-white/3' : 'bg-yellow-950/30'}`}>
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0
        ${isLinked ? 'bg-green-500' : 'bg-yellow-500'}`} />

      {/* Product name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{row.name}</p>
        <p className="text-[var(--text-muted)] text-xs capitalize">{row.category}</p>
      </div>

      {/* SKU input */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          className="w-24 px-2 py-1 text-sm rounded-lg border border-white/10
                     bg-[var(--bg-main)] text-center font-mono
                     focus:outline-none focus:border-brand-accent"
          placeholder="FF-001"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={e => {
            if (e.target.value.trim() !== (row.epos_now_id ?? '')) {
              onSave(row.id, e.target.value)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
        />
        <span className="w-5 text-center flex-shrink-0">
          {isSaving ? (
            <span className="text-[var(--text-muted)] text-xs animate-pulse">…</span>
          ) : isSaved ? (
            <span className="text-green-400 text-sm">✓</span>
          ) : error ? (
            <span className="text-red-400 text-sm" title={error}>!</span>
          ) : null}
        </span>
      </div>
    </div>
  )
}
