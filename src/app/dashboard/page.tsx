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

  // Each alert surfaces as an attention badge on its relevant tile — no top cards.
  const pricingBadge   = pendingCount                                  // prices to approve
  const invoicesBadge  = (pendingDeliveryCount ?? 0) + unmappedCount   // notes to confirm + needs mapping
  const productsBadge  = blockedCosts.length + atLossCount + belowFloorCount + unpricedCount
  const productsUrgent = blockedCosts.length > 0 || atLossCount > 0    // at-loss / wrong-cost ⇒ red
  const dispatchBadge  = confirmedOrderCount ?? 0                      // deliveries ready

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

      {/* Products & stock */}
      <p className="section-title">Products</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction href="/products"         icon="🥦" label="Products" badge={productsBadge} tone={productsUrgent ? 'red' : 'amber'} />
        <QuickAction href="/shop-order"       icon="🧺" label="Shop Order" />
        <QuickAction href="/market-run"        icon="🛒" label="Market Run" />
        <QuickAction href="/dispatch"         icon="🚐" label="Dispatch" badge={dispatchBadge} tone="green" />
        <QuickAction href="/invoices"         icon="📋" label="Invoices" badge={invoicesBadge} tone="amber" />
        <QuickAction href="/waste"            icon="🗑️" label="Waste Log" />
      </div>

      {/* Pricing & analysis */}
      <p className="section-title">Pricing</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <QuickAction href="/pricing"          icon="💰" label="Pricing" badge={pricingBadge} tone="amber" />
        <QuickAction href="/epos-compare"     icon="📈" label="Price Check" />
        <QuickAction href="/price-history"    icon="🔍" label="Price History" />
        <QuickAction href="/margins"          icon="📊" label="Margins" />
        <QuickAction href="/margins/sim"      icon="🧮" label="Simulator" />
        <QuickAction href="/wholesale-lookup" icon="🏷️" label="Price Lookup" />
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

const TONE_BADGE = { red: 'bg-status-red', amber: 'bg-status-amber', green: 'bg-brand-accent' } as const
const TONE_RING  = { red: 'ring-2 ring-status-red/50', amber: 'ring-2 ring-status-amber/50', green: 'ring-2 ring-brand-accent/40' } as const

function QuickAction({ href, icon, label, badge = 0, tone = 'amber' }: {
  href: string; icon: string; label: string; badge?: number; tone?: 'red' | 'amber' | 'green'
}) {
  const show = badge > 0
  return (
    <Link href={href} className={`card relative flex flex-col items-center justify-center
                                  gap-2 min-h-[80px] active:scale-95 transition-transform text-center
                                  ${show ? TONE_RING[tone] : ''}`}>
      {show && (
        <span className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full
                          text-xs font-bold text-white flex items-center justify-center shadow
                          ${TONE_BADGE[tone]}`}>
          {badge}
        </span>
      )}
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
