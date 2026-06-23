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

  const { data: pendingSuggestions } = await supabase
    .from('price_suggestions')
    .select('product_id')
    .eq('status', 'pending')
  const pendingCount = pendingSuggestions?.length ?? 0
  // A product with a pending suggestion is already actionable via "approve" — so it
  // shouldn't ALSO show up as a health issue or a wrong-cost card. Dedupe by product.
  const pendingProductIds = new Set((pendingSuggestions ?? []).map(s => s.product_id))

  // "Needs mapping" nudge — only for descriptions that actually landed on a delivery
  // in the last 14 days. Older unmapped descriptions stay in the /invoice-mapping
  // backlog but stop nagging here until they arrive on a delivery again. (Pending
  // mapping rows aren't bumped on reappearance, so the invoice line date is the
  // truthful "recently seen" signal, not the mapping row's timestamp.)
  const mappingCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: recentUnmatched } = await supabase
    .from('purchase_invoice_items')
    .select('product_name_raw, purchase_invoices!inner(invoice_date)')
    .is('product_id', null)
    .gte('purchase_invoices.invoice_date', mappingCutoff)
    .limit(5000)
  const recentRawSet = new Set((recentUnmatched ?? []).map(r => r.product_name_raw.toLowerCase()))

  const { data: pendingMappings } = await supabase
    .from('supplier_product_mappings')
    .select('raw_description')
    .eq('status', 'pending')
    .limit(9999)
  const unmappedCount = (pendingMappings ?? []).filter(m => recentRawSet.has(m.raw_description.toLowerCase())).length

  const { count: pendingDeliveryCount } = await supabase
    .from('purchase_invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'uploaded')

  const { count: confirmedOrderCount } = await supabase
    .from('wholesale_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')

  const healthIssues    = (await getProductHealthIssues(supabase))
    .filter(i => !pendingProductIds.has(i.productId))   // already covered by a pending price approval
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
  // Collapse to one card per product — the post-confirm check and the pipeline can
  // both flag the same cost in the same second, otherwise the product shows twice
  // (and React sees duplicate keys). Rows are newest-first, so we keep the latest.
  const seenBlocked = new Set<string>()
  blockedCosts = blockedCosts.filter(b => {
    if (seenBlocked.has(b.product_id)) return false
    seenBlocked.add(b.product_id)
    return true
  })
  // Suppress wrong-cost cards for products that already have a pending price approval —
  // the approve flow is the single place to resolve them (no triple-listing).
  blockedCosts = blockedCosts.filter(b => !pendingProductIds.has(b.product_id))

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const displayName = profile?.full_name?.split(' ')[0] ?? 'David'

  const hasPending         = (pendingCount ?? 0) > 0
  const hasUnmapped        = (unmappedCount ?? 0) > 0
  const hasPendingDelivery = (pendingDeliveryCount ?? 0) > 0
  const hasDeliveries      = (confirmedOrderCount ?? 0) > 0

  // Everything that needs David's eye, collapsed behind one flag instead of a
  // stack of banners. Each row still deep-links to where it gets fixed.
  const attention: { key: string; href: string; title: string; sub: string; urgent?: boolean }[] = []
  if (hasPending) attention.push({ key: 'pricing', href: '/pricing',
    title: `${pendingCount} price${pendingCount !== 1 ? 's' : ''} need approval`, sub: 'Review & approve →' })
  if (hasPendingDelivery) attention.push({ key: 'confirm', href: '/invoices',
    title: `${pendingDeliveryCount} delivery ${pendingDeliveryCount === 1 ? 'note' : 'notes'} to confirm`, sub: 'Check costs →' })
  if (hasUnmapped) attention.push({ key: 'mapping', href: '/invoice-mapping?recent=1',
    title: `${unmappedCount} delivery ${unmappedCount === 1 ? 'product' : 'products'} need mapping`, sub: 'Match once, automatic after →' })
  for (const b of blockedCosts) attention.push({ key: `cost-${b.product_id}`, href: `/products/${b.product_id}`,
    title: `Wrong cost — ${b.product_name}`, sub: 'Fix now →', urgent: true })
  if (atLossCount + belowFloorCount + unpricedCount > 0) {
    const total = atLossCount + belowFloorCount + unpricedCount
    const parts = [
      atLossCount     > 0 ? `${atLossCount} at a loss`        : null,
      belowFloorCount > 0 ? `${belowFloorCount} below floor`  : null,
      unpricedCount   > 0 ? `${unpricedCount} unpriced`       : null,
    ].filter(Boolean)
    attention.push({ key: 'health', href: '/products?category=issues',
      title: `${total} ${total === 1 ? 'product' : 'products'} need attention`, sub: `${parts.join(' · ')} →`, urgent: atLossCount > 0 })
  }
  const attentionCount  = attention.length
  const attentionUrgent = attention.some(a => a.urgent)

  return (
    <div className="light min-h-screen bg-[var(--bg)] text-[var(--text)]">
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

      {/* Grouped attention — one flag instead of a stack of banners */}
      {attentionCount > 0 && (
        <details open className={`card mb-4 border ${attentionUrgent
          ? 'border-status-red/50 bg-status-red/5'
          : 'border-status-amber/40 bg-status-amber/5'}`}>
          <summary className="flex items-center justify-between cursor-pointer list-none
                              select-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚩</span>
              <div>
                <p className={`font-bold text-sm ${attentionUrgent ? 'text-status-red' : ''}`}>
                  Needs attention
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Tap to expand / collapse</p>
              </div>
            </div>
            <span className={`text-white text-sm font-bold rounded-full w-8 h-8 flex items-center
                             justify-center flex-shrink-0 ml-3
                             ${attentionUrgent ? 'bg-status-red' : 'bg-status-amber'}`}>
              {attentionCount}
            </span>
          </summary>
          <div className="mt-3 space-y-2">
            {attention.map(a => (
              <Link key={a.key} href={a.href}
                className="flex items-center justify-between rounded-xl bg-[var(--bg)] px-3 py-2.5
                           active:scale-[0.99] transition-transform">
                <div>
                  <p className={`text-sm font-medium ${a.urgent ? 'text-status-red' : ''}`}>{a.title}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.sub}</p>
                </div>
                <span className="text-[var(--text-muted)] text-lg flex-shrink-0 ml-3">›</span>
              </Link>
            ))}
          </div>
        </details>
      )}

      {/* Deliveries ready — its own flag, same treatment */}
      {hasDeliveries && (
        <Link href="/dispatch" className="block mb-4">
          <div className="card border border-brand-accent/50 bg-brand-accent/10
                          flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚐</span>
              <div>
                <p className="font-bold text-sm">Deliveries ready</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Tap to start dispatch →</p>
              </div>
            </div>
            <span className="bg-brand-accent text-white text-sm font-bold rounded-full w-8 h-8
                             flex items-center justify-center flex-shrink-0 ml-3">
              {confirmedOrderCount}
            </span>
          </div>
        </Link>
      )}

      {/* Products & stock */}
      <p className="section-title">Products</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction href="/products"         icon="🥦" label="Products" />
        <QuickAction href="/invoices"         icon="📋" label="Invoices" />
        <QuickAction href="/shop-order"       icon="🧺" label="Shop Order" />
        <QuickAction href="/market-run"        icon="🛒" label="Market Run" />
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
        <QuickAction href="/invoices/new"     icon="📄" label="Upload invoice" />
      </div>
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
