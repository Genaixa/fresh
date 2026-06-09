'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function SupplierSelect({
  suppliers,
  current,
}: {
  suppliers: { id: string; name: string }[]
  current?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set('supplier', e.target.value)
    else params.delete('supplier')
    router.replace(`/products?${params.toString()}`)
  }

  return (
    <select
      value={current ?? ''}
      onChange={handleChange}
      className="input-field text-sm py-2"
    >
      <option value="">All suppliers</option>
      {suppliers.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )
}
