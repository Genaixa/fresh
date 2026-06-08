import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getProductHealthIssues, type ProductHealthIssue } from '@/lib/data-health'
import { NavBar } from '@/components/ui/NavBar'

const TYPE_META: Record<string, { label: string; colour: string; icon: string }> = {
  at_loss:     { label: 'Selling at a loss',  colour: 'status-red',   icon: '🔴' },
  below_floor: { label: 'Below margin floor', colour: 'status-amber', icon: '⚠️' },
  unpriced:    { label: 'Not priced',         colour: 'status-amber', icon: '🏷️' },
  cost_spike:  { label: 'Cost spike',         colour: 'brand-accent', icon: '📈' },
  no_cost:     { label: 'No cost data',       colour: 'white/40',     icon: '❓' },
}

export default async function PriceMonitorPage() {
  const supabase = await createClient()
  const issues = await getProductHealthIssues(supabase)

  const atLoss    = issues.filter(i => i.type === 'at_loss')
  const belowFloor= issues.filter(i => i.type === 'below_floor')
  const unpriced  = issues.filter(i => i.type === 'unpriced')
  const spikes    = issues.filter(i => i.type === 'cost_spike')

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">Price Health</h1>
      </div>

      {issues.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-semibold text-status-green">Everything looks healthy</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">All products priced above cost and margin floor</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Selling at a loss — most urgent */}
          {atLoss.length > 0 && (
            <Section
              title="Selling at a loss"
              icon="🔴"
              count={atLoss.length}
              borderColour="border-status-red/50"
              issues={atLoss}
            />
          )}

          {/* Below floor */}
          {belowFloor.length > 0 && (
            <Section
              title="Below margin floor"
              icon="⚠️"
              count={belowFloor.length}
              borderColour="border-status-amber/50"
              issues={belowFloor}
            />
          )}

          {/* Cost spikes */}
          {spikes.length > 0 && (
            <Section
              title="Cost spikes — prices may need updating"
              icon="📈"
              count={spikes.length}
              borderColour="border-brand-accent/40"
              issues={spikes}
            />
          )}

          {/* Unpriced */}
          {unpriced.length > 0 && (
            <Section
              title="Not yet priced"
              icon="🏷️"
              count={unpriced.length}
              borderColour="border-white/20"
              issues={unpriced}
            />
          )}

        </div>
      )}

      <NavBar />
    </div>
  )
}

function Section({
  title, icon, count, borderColour, issues,
}: {
  title: string
  icon: string
  count: number
  borderColour: string
  issues: ProductHealthIssue[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <p className="section-title mb-0">{title}</p>
        <span className="text-xs text-[var(--text-muted)]">({count})</span>
      </div>
      <div className="space-y-2">
        {issues.map(issue => (
          <Link key={issue.productId} href={`/products/${issue.productId}`}
            className={`card border ${borderColour} flex items-center justify-between active:scale-95 transition-transform`}>
            <div className="min-w-0">
              <p className="font-medium text-sm">{issue.productName}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{issue.detail}</p>
            </div>
            <span className="text-[var(--text-muted)] ml-3 flex-shrink-0">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
