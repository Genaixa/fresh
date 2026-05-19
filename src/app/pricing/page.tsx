import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'
import { approveAll, approveSuggestion, rejectSuggestion } from './actions'
import type { PriceSuggestion } from '@/types'

export default async function PricingSuggestionsPage() {
  const supabase = await createClient()

  const { data: suggestions } = await supabase
    .from('price_suggestions')
    .select('*, product:products(name, margin_floor)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const pending = suggestions ?? []
  const warnings = pending.filter((s: PriceSuggestion) => s.margin_warning)

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Price Suggestions</h1>
        {pending.length > 0 && (
          <form action={approveAll}>
            <button className="btn-primary px-4 py-2 text-sm min-h-[40px]">
              ✓ Approve All
            </button>
          </form>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl bg-status-amber/10 border border-status-amber/30
                        px-4 py-3 text-sm text-status-amber">
          ⚠️ {warnings.length} item{warnings.length > 1 ? 's' : ''} below margin floor
        </div>
      )}

      {pending.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-semibold">All prices up to date</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Upload an invoice to get new suggestions
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((s: PriceSuggestion & { product: { name: string; margin_floor: number } }) => {
            const delta = s.suggested_retail_price - s.current_retail_price
            const direction = delta > 0 ? '▲' : delta < 0 ? '▼' : '●'
            const dirColour = delta > 0 ? 'text-status-green' : delta < 0 ? 'text-status-red' : 'text-gray-400'

            return (
              <details key={s.id} className="card">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${dirColour}`}>{direction}</span>
                    <div>
                      <p className="font-medium">{s.product?.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatPrice(s.current_retail_price)} → {formatPrice(s.suggested_retail_price)}
                        {s.margin_warning && (
                          <span className="ml-2 text-status-amber">⚠</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    <form action={approveSuggestion.bind(null, s.id)}>
                      <button className="min-h-[44px] min-w-[44px] rounded-xl
                                         bg-status-green/20 text-status-green font-bold text-lg
                                         flex items-center justify-center">
                        ✓
                      </button>
                    </form>
                    <form action={rejectSuggestion.bind(null, s.id)}>
                      <button className="min-h-[44px] min-w-[44px] rounded-xl
                                         bg-status-red/20 text-status-red font-bold text-lg
                                         flex items-center justify-center">
                        ✗
                      </button>
                    </form>
                  </div>
                </summary>

                {/* Expanded detail */}
                <div className="mt-3 pt-3 border-t border-white/10 text-sm space-y-1
                                text-[var(--text-muted)]">
                  <p>Rule applied: <span className="text-[var(--text)] capitalize">{s.rule_applied}</span></p>
                  {s.margin_percentage !== null && (
                    <p>Margin: <span className={s.margin_warning ? 'text-status-amber' : 'text-status-green'}>
                      {formatMargin(s.margin_percentage)}
                    </span>
                    {s.margin_warning && ` (floor: ${formatMargin(s.product?.margin_floor ?? 0.2)})`}
                    </p>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-[var(--text-muted)] mt-4">
        {pending.length} pending · {warnings.length} warnings
      </p>

      <NavBar />
    </div>
  )
}
