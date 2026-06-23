'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('q', e.target.value)
    } else {
      params.delete('q')
    }
    router.replace(`/products?${params.toString()}`)
  }, [router, searchParams])

  return (
    <input
      defaultValue={defaultValue}
      onChange={handleChange}
      placeholder="Search products..."
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                 px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                 focus:outline-none focus:ring-2 focus:ring-brand-accent"
    />
  )
}
