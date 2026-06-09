import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
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

  const healthIssues  = await getProductHealthIssues(supabase)
  const atLossCount   = healthIssues.filter(i => i.type === 'at_loss').length
  const unpricedCount = healthIssues.filter(i => i.type === 'unpriced').length
  const spikeCount    = healthIssues.filter(i => i.type === 'cost_spike').length

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

  // Only alert if the dangerous value is actually the current cost right now
  const blockedProductIds = [...new Set((blockedAudit ?? []).map(a => a.product_id).filter(Boolean))]
  let blockedCosts: typeof blockedAudit = []
  if (blockedProductIds.length > 0) {
    const { data: currentCosts } = await supabase
      .from('products')
      .select('id, purchase_cost')
      .in('id', blockedProductIds)
    const costMap = new Map((currentCosts ?? []).map(p => [p.id, p.purchase_cost]))
    blockedCosts = (blockedAudit ?? []).filter(a =>
      a.product_id && costMap.get(a.product_id) === a.proposed_cost
    )
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

      {/* Blocked cost updates — pipeline rejected a dangerous write */}
      {blockedCostCount > 0 && (
        <div className="card border-2 border-status-red bg-status-red/10 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🛡</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-status-red text-sm">
                Cost update blocked — check manually
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-2">
                The system rejected {blockedCostCount} suspicious cost {blockedCostCount === 1 ? 'change' : 'changes'} in the last 7 days to protect your margins. Review and set the correct cost.
              </p>
              {blockedCosts?.map((b, i) => (
                <div key={i} className="text-xs mb-1 font-medium">
                  <span className="text-white">{b.product_name}</span>
                  <span className="text-[var(--text-muted)]">
                    {' '}— tried to set {b.proposed_cost}p
                    {b.old_cost ? ` (was ${b.old_cost}p)` : ''}
                  </span>
                </div>
              ))}
              <Link href="/products" className="text-xs text-status-red font-semibold mt-1 inline-block">
                Fix costs in Products →
              </Link>
            </div>
          </div>
        </div>
      )}


      {/* Selling at a loss — highest urgency */}
      {atLossCount > 0 && (
        <Link href="/price-monitor" className="block mb-4">
          <div className="card border border-status-red/60 bg-status-red/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-status-red">
                  {atLossCount} {atLossCount === 1 ? 'product' : 'products'} selling at a loss
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Cost exceeds retail price →</p>
              </div>
              <span className="bg-status-red text-white text-sm font-bold
                               rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 ml-3">
                {atLossCount}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Cost spikes */}
      {spikeCount > 0 && (
        <Link href="/price-monitor" className="block mb-4">
          <div className="card border border-status-amber/40 bg-status-amber/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {spikeCount} {spikeCount === 1 ? 'product' : 'products'} with rising costs
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Prices may need adjusting →</p>
              </div>
              <span className="bg-status-amber text-white text-sm font-bold
                               rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 ml-3">
                {spikeCount}
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* Unpriced products */}
      {unpricedCount > 0 && (
        <Link href="/price-monitor" className="block mb-4">
          <div className="card border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">
                  {unpricedCount} {unpricedCount === 1 ? 'product' : 'products'} not yet priced
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Known cost, no retail price set →</p>
              </div>
              <span className="bg-white/20 text-sm font-bold
                               rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 ml-3">
                {unpricedCount}
              </span>
            </div>
          </div>
        </Link>
      )}

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

      {/* Quick actions grid */}
      <p className="section-title">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <QuickAction href="/waste"            icon="⚠️" label="Log Waste" />
        <QuickAction href="/margins"          icon="📊" label="Margins" />
        <QuickAction href="/price-history"    icon="🔍" label="Price History" />
        <QuickAction href="/pricing"          icon="💰" label="Pricing" />
        <QuickAction href="/products"         icon="🥦" label="Products" />
        <QuickAction href="/sync"             icon="🔄" label="EPOS Sync" />
        <QuickAction href="/epos-compare"     icon="📈" label="Price Check" />
        <QuickAction href="/margins/sim"      icon="🧮" label="Simulator" />
        <QuickAction href="/price-monitor"    icon="🤖" label="AI Monitor" />
        <QuickAction href="/invoices"         icon="📋" label="Invoices" />
        <QuickAction href="/suppliers"        icon="🏪" label="Suppliers" />
        <QuickAction href="/wholesale-lookup" icon="👤" label="Wholesale" />
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
