import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import Link from 'next/link'
import { logout } from '@/app/login/actions'

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

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const displayName = profile?.full_name?.split(' ')[0] ?? 'David'

  const hasPending  = (pendingCount ?? 0) > 0
  const hasUnmapped = (unmappedCount ?? 0) > 0

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

      {/* Quick actions grid */}
      <p className="section-title">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <QuickAction href="/waste"           icon="⚠️" label="Log Waste" />
        <QuickAction href="/margins"         icon="📊" label="Margins" />
        <QuickAction href="/price-history"   icon="🔍" label="Price History" />
        <QuickAction href="/pricing"         icon="💰" label="Pricing" />
      </div>

      {/* More section */}
      <details className="group">
        <summary className="section-title cursor-pointer list-none flex items-center gap-1">
          More
          <span className="text-xs group-open:rotate-180 transition-transform inline-block">▼</span>
        </summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <QuickAction href="/products"       icon="🥦" label="Products" />
          <QuickAction href="/sync"           icon="🔄" label="EPOS Sync" />
          <QuickAction href="/epos-compare"  icon="📈" label="Price Check" />
          <QuickAction href="/margins/sim"    icon="🧮" label="Simulator" />
          <QuickAction href="/price-monitor"  icon="🤖" label="AI Monitor" />
          <QuickAction href="/invoices"       icon="📋" label="Invoices" />
          <QuickAction href="/suppliers"      icon="🏪" label="Suppliers" />
          <QuickAction href="/wholesale-lookup" icon="👤" label="Wholesale" />
        </div>
      </details>
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
