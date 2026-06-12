'use client'

import { useState } from 'react'
import Link from 'next/link'

type P = { id: string; name: string }

export function WastePicker({ products, frequentIds, selectedId }: {
  products: P[]
  frequentIds: string[]
  selectedId?: string
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const matches = query
    ? products.filter(p => p.name.toLowerCase().includes(query)).slice(0, 30)
    : []
  const frequent = frequentIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is P => !!p)

  const Tile = ({ p }: { p: P }) => (
    <Link
      href={`/waste?product_id=${p.id}`}
      className={`card text-sm font-medium min-h-[48px] flex items-center justify-center
                  text-center active:scale-95 transition-transform
                  ${selectedId === p.id ? 'border-2 border-brand-accent' : ''}`}
    >
      {p.name}
    </Link>
  )

  return (
    <div className="mb-6">
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search product…"
        className="input-field mb-3"
        autoComplete="off"
      />

      {query ? (
        matches.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {matches.map(p => <Tile key={p.id} p={p} />)}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            Nothing matches “{q}”
          </p>
        )
      ) : (
        <>
          {frequent.length > 0 && (
            <>
              <p className="section-title">Often wasted</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {frequent.map(p => <Tile key={p.id} p={p} />)}
              </div>
            </>
          )}
          <details>
            <summary className="text-sm text-brand-accent font-medium cursor-pointer py-2 min-h-[48px] flex items-center">
              All products ({products.length}) ▾
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {products.map(p => <Tile key={p.id} p={p} />)}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
