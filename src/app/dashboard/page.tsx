import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import { getProductHealthIssues } from '@/lib/data-health'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const { count: pendingCount } = await supabase
    .from('price_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: unmappedCount } = await supabase
    .from('supplier_product_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: pendingDeliveryCount } = await supabase
    .from('purchase_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'uploaded')

  const { count: confirmedOrderCount } = await supabase
    .from('wholesale_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')

  const healthIssues    = await getProductHealthIssues(supabase)
  const atLossCount     = healthIssues.filter(i => i.type === 'at_loss').length
  const unpricedCount   = healthIssues.filter(i => i.type === 'unpriced').length
  const belowFloorCount = healthIssues.filter(i => i.type === 'below_floor').length

  // Blocked cost writes where the bad value actually got into the DB
  // (trigger correctly protected = current cost stayed at old_cost = nothing to fix)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: blockedAudit } = await supabase
    .from('cost_change_audit')
    .select('product_id, product_name, old_cost, proposed_cost')
    .eq('blocked', true)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20)

  // Only alert if the dangerous value is in the DB now AND it's not an intentional loss leader
  const blockedProductIds = [...new Set((blockedAudit ?? []).map(a => a.product_id).filter(Boolean))]
  let blockedCosts: (NonNullable<typeof blockedAudit>[0] & { product_id: string })[] = []
  if (blockedProductIds.length > 0) {
    const { data: currentCosts } = await supabase
      .from('products')
      .select('id, purchase_cost, margin_floor')
      .in('id', blockedProductIds)
    const productMap = new Map((currentCosts ?? []).map(p => [p.id, p]))
    blockedCosts = (blockedAudit ?? []).filter((a): a is typeof a & { product_id: string } => {
      if (!a.product_id) return false
      const p = productMap.get(a.product_id)
      if (!p) return false
      if (p.margin_floor < 0) return false          // intentional loss leader — not a bug
      return p.purchase_cost === a.proposed_cost    // bad value actually got in
    })
  }
  const blockedCostCount = blockedCosts.length

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const displayName = profile?.full_name?.split(' ')[0] ?? 'David'

  const hasPending         = (pendingCount ?? 0) > 0
  const hasUnmapped        = (unmappedCount ?? 0) > 0
  const hasPendingDelivery = (pendingDeliveryCount ?? 0) > 0
  const hasDeliveries      = (confirmedOrderCount ?? 0) > 0

  return (
    <div className="page pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[var(--text-muted)] text-sm">{greeting}, {displayName}</p>
          <p className="text-xs text-[var(--text-muted)]">{dateStr}</p>
        </div>
        <form action={logout}>
          <button className="text-[var(--text-muted)] text-sm min-h-[48px] min-w-[48px]
                             flex items-center justify-center">
            Sign out
          </button>
        </form>
      </div>

      {/* Primary CTA */}
      {hasPending ? (
        <Link href="/pricing" className="block mb-8">
          <div className="card bg-brand-accent text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">
                  {pendingCount} price{pendingCount !== 1 ? 's' : ''} need approval
                </p>
                <p className="text-white/80 text-sm mt-0.5">Tap to review →</p>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>
        </Link>
      ) : (
        <Link href="/invoices/new" className="block mb-8">
          <div className="card border-2 border-brand-accent/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">Upload today's invoice</p>
                <p className="text-[var(--text-muted)] text-sm mt-0.5">Scan market prices →</p>
              </div>
              <span className="text-4xl">📄</span>
            </div>
          </div>
        </Link>
      )}

      {/* Unmapped products banner */}
      {hasUnmapped && (
        <Link href="/invoice-mapping" className="block mb-4">
          <div className="card border border-status-red/40 bg-status-red/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {unmappedCount} delivery {unmappedCount === 1 ? 'product' : 'products'} need mapping
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Tap to match once — automatic forever after
                </p>
              </div>
              <span className="bg-status-red text-white text-sm font-bold
                               rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 ml-3">
                {unmappedCount}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Pending delivery notes banner */}
      {hasPendingDelivery && (
        <Link href="/invoices" className="block mb-4">
          <div className="card border border-status-amber/40 bg-status-amber/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {pendingDeliveryCount} delivery {pendingDeliveryCount === 1 ? 'note' : 'notes'} to confirm
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Tap to review costs →
                </p>
              </div>
              <span className="bg-status-amber text-white text-sm font-bold
                               rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 ml-3">
                {pendingDeliveryCount}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Blocked cost — bad value actually got into the DB (rare/emergency) */}
      {blockedCostCount > 0 && blockedCosts.map(b => (
        <Link key={b.product_id} href={`/products/${b.product_id}`} className="block mb-4">
          <div className="card border-2 border-status-red bg-status-red/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-status-red text-sm">Wrong cost — fix now</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {b.product_name} → tap to fix
                </p>
              </div>
              <span className="text-2xl flex-shrink-0 ml-3">🛡</span>
            </div>
          </div>
        </Link>
      ))}

      {/* Combined price health — all health issues in one card */}
      {(atLossCount > 0 || belowFloorCount > 0 || unpricedCount > 0) && (() => {
        const total    = atLossCount + belowFloorCount + unpricedCount
        const isUrgent = atLossCount > 0
        const parts    = [
          atLossCount     > 0 ? `${atLossCount} at a loss`                                        : null,
          belowFloorCount > 0 ? `${belowFloorCount} below floor`                                  : null,
          unpricedCount   > 0 ? `${unpricedCount} unpriced`                                       : null,
        ].filter(Boolean)
        return (
          <Link href="/products?category=issues" className="block mb-4">
            <div className={`card border ${isUrgent
              ? 'border-status-red/60 bg-status-red/5'
              : 'border-status-amber/40 bg-status-amber/5'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-semibold text-sm ${isUrgent ? 'text-status-red' : ''}`}>
                    {total} {total === 1 ? 'product' : 'products'} need attention
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{parts.join(' · ')} →</p>
                </div>
                <span className={`text-sm font-bold rounded-full w-8 h-8 flex items-center
                                  justify-center flex-shrink-0 ml-3
                                  ${isUrgent ? 'bg-status-red text-white' : 'bg-status-amber text-white'}`}>
                  {total}
                </span>
              </div>
            </div>
          </Link>
        )
      })()}

      {/* Dispatch banner */}
      {hasDeliveries && (
        <Link href="/dispatch" className="block mb-4">
          <div className="card border border-brand-accent/50 bg-brand-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">
                  {confirmedOrderCount} {confirmedOrderCount === 1 ? 'delivery' : 'deliveries'} ready
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Tap to start dispatch →</p>
              </div>
              <span className="text-3xl">🚐</span>
            </div>
          </div>
        </Link>
      )}

      {/* Products & stock */}
      <p className="section-title">Products</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction href="/products"         icon="🥦" label="Products" />
        <QuickAction href="/invoices"         icon="📋" label="Invoices" />
        <QuickAction href="/waste"            icon="🗑️" label="Waste Log" />
      </div>

      {/* Pricing & analysis */}
      <p className="section-title">Pricing</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction href="/pricing"          icon="💰" label="Pricing" />
        <QuickAction href="/epos-compare"     icon="📈" label="Price Check" />
        <QuickAction href="/price-history"    icon="🔍" label="Price History" />
        <QuickAction href="/margins"          icon="📊" label="Margins" />
        <QuickAction href="/margins/sim"      icon="🧮" label="Simulator" />
        <QuickAction href="/wholesale-lookup" icon="👤" label="Wholesale" />
      </div>

      {/* Settings */}
      <p className="section-title">Settings</p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <QuickAction href="/suppliers"        icon="🏪" label="Suppliers" />
        <QuickAction href="/sync"             icon="🔄" label="EPOS Sync" />
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center justify-center
                                  gap-2 min-h-[80px] active:scale-95 transition-transform text-center">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
