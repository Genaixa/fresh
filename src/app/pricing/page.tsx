import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'
import { approveAll, rejectAll, approveSuggestion, rejectSuggestion, amendAndApproveSuggestion } from './actions'
import type { PriceSuggestion } from '@/types'

export default async function PricingSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>
}) {
  const { show } = await searchParams
  const supabase = await createClient()

  const { data: suggestions } = await supabase
    .from('price_suggestions')
    .select('*, product:products(name, margin_floor)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const pending  = suggestions ?? []
  const warnings = pending.filter((s: PriceSuggestion) => s.margin_warning)
  const good     = pending.filter((s: PriceSuggestion) => !s.margin_warning)

  const displayed = show === 'warnings' ? warnings
                  : show === 'good'     ? good
                  : pending

  return (
    <div className="page pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Price Suggestions</h1>
      </div>

      {/* Filter tiles */}
      {pending.length > 0 && (
        <div className="card mb-6 flex gap-4">
          <a href={show === 'warnings' ? '/pricing' : '/pricing?show=warnings'}
            className={`flex-1 text-center rounded-xl py-2 transition-colors
              ${show === 'warnings' ? 'bg-status-amber/20 ring-1 ring-status-amber' : 'active:bg-white/5'}`}>
            <p className="text-2xl font-bold text-status-amber">{warnings.length}</p>
            <p className="text-xs text-[var(--text-muted)]">Below Floor</p>
          </a>
          <a href={show === 'good' ? '/pricing' : '/pricing?show=good'}
            className={`flex-1 text-center rounded-xl py-2 transition-colors
              ${show === 'good' ? 'bg-status-green/20 ring-1 ring-status-green' : 'active:bg-white/5'}`}>
            <p className="text-2xl font-bold text-status-green">{good.length}</p>
            <p className="text-xs text-[var(--text-muted)]">Good</p>
          </a>
          <a href="/pricing"
            className={`flex-1 text-center rounded-xl py-2 transition-colors
              ${!show ? 'bg-white/10 ring-1 ring-white/30' : 'active:bg-white/5'}`}>
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-[var(--text-muted)]">All</p>
          </a>
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
        <>
          <div className="space-y-2">
            {displayed.map((s: PriceSuggestion & { product: { name: string; margin_floor: number } }) => {
              const delta     = s.suggested_retail_price - s.current_retail_price
              const direction = delta > 0 ? '▲' : delta < 0 ? '▼' : '●'
              const dirColour = delta > 0 ? 'text-status-green' : delta < 0 ? 'text-status-red' : 'text-gray-400'
              const suggestedPounds = (s.suggested_retail_price / 100).toFixed(2)

              return (
                <details key={s.id} className="card">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-lg ${dirColour}`}>{direction}</span>
                      <div>
                        <p className="font-medium">{s.product?.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {formatPrice(s.current_retail_price)} → {formatPrice(s.suggested_retail_price)}
                          {s.margin_warning && <span className="ml-2 text-status-amber">⚠</span>}
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
                  <div className="mt-3 pt-3 border-t border-white/10 text-sm space-y-3">
                    <div className="space-y-1 text-[var(--text-muted)]">
                      <p>Rule: <span className="text-[var(--text)] capitalize">{s.rule_applied}</span></p>
                      {s.margin_percentage !== null && (
                        <p>Margin: <span className={s.margin_warning ? 'text-status-amber' : 'text-status-green'}>
                          {formatMargin(s.margin_percentage)}
                        </span>
                        {s.margin_warning && ` (floor: ${formatMargin(s.product?.margin_floor ?? 0.2)})`}
                        </p>
                      )}
                    </div>

                    {/* Amend price */}
                    <form action={amendAndApproveSuggestion.bind(null, s.id)}
                          className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">£</span>
                        <input
                          name="price_pounds"
                          type="number"
                          step="0.01"
                          min="0.01"
                          defaultValue={suggestedPounds}
                          className="input-field pl-7 py-2 text-sm"
                        />
                      </div>
                      <button type="submit"
                        className="btn-primary px-4 py-2 text-sm min-h-[44px] whitespace-nowrap">
                        Approve at this price
                      </button>
                    </form>
                  </div>
                </details>
              )
            })}
          </div>

          {/* Bulk actions */}
          <div className="flex gap-3 mt-6">
            <form action={approveAll} className="flex-1">
              <button className="btn-primary w-full py-3 text-sm">
                ✓ Approve All
              </button>
            </form>
            <form action={rejectAll} className="flex-1">
              <button className="w-full py-3 rounded-xl border border-status-red/40
                                 text-status-red text-sm active:bg-status-red/10 transition-colors">
                ✗ Reject All
              </button>
            </form>
          </div>
        </>
      )}

      <p className="text-center text-xs text-[var(--text-muted)] mt-4">
        {displayed.length} shown · {pending.length} pending · {warnings.length} below floor
      </p>

      <NavBar />
    </div>
  )
}
