'use client'

import { useRouter } from 'next/navigation'

export function ProductSelector({
  products,
  selectedId,
}: {
  products: { id: string; name: string }[]
  selectedId: string | undefined
}) {
  const router = useRouter()

  return (
    <select
      value={selectedId ?? ''}
      onChange={e => {
        const id = e.target.value
        router.push(id ? `/price-history?product_id=${id}` : '/price-history')
      }}
      className="input-field"
    >
      <option value="">— Select a product —</option>
      {products.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}
