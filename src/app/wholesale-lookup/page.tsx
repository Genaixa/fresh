import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { formatPrice } from '@/lib/pricing-engine'
import type { Product } from '@/types'

export default async function WholesaleLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let product: Product | null = null

  if (q && q.trim()) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .gt('wholesale_price', 0)
      .order('name')
      .limit(1)
      .maybeSingle()
    product = data
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-brand-dark text-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-lg">🍋 Fresh & Fruity</p>
          <p className="text-sm text-white/70">Wholesale Prices</p>
        </div>
        <form action={logout}>
          <button className="text-white/70 text-sm min-h-[44px]">Sign out</button>
        </form>
      </div>

      <div className="flex-1 page">
        {/* Search */}
        <form className="mb-8">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search product..."
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-[var(--bg-card)]
                       px-4 py-4 text-xl text-[var(--text)] min-h-[60px]
                       focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </form>

        {/* Result */}
        {product ? (
          <div className="card text-center py-10">
            <p className="text-[var(--text-muted)] text-sm mb-2">{product.name}</p>
            <p className="text-6xl font-bold text-brand-accent mb-1">
              {formatPrice(product.wholesale_price)}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Full box · per {product.unit}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-4">
              Updated {new Date(product.updated_at).toLocaleTimeString('en-GB', {
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        ) : q ? (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">No wholesale price found</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Try a different search</p>
          </div>
        ) : (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🥦</p>
            <p className="text-[var(--text-muted)]">Type a product name above</p>
          </div>
        )}
      </div>
    </div>
  )
}
