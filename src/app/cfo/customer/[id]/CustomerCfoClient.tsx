'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CustomerSummary } from './page'

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`
const pct = (n: number) => `${Math.round(n * 100)}%`

function MarginBar({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-gray-300 text-xs">—</span>
  const colour = margin < 0 ? 'text-red-600 font-bold' : margin < 0.20 ? 'text-amber-600 font-semibold' : 'text-green-700 font-semibold'
  return <span className={`text-xs ${colour}`}>{pct(margin)}</span>
}

const PERIODS = [
  { weeks: 4,  label: '4w'  },
  { weeks: 12, label: '3mo' },
  { weeks: 26, label: '6mo' },
  { weeks: 52, label: '1yr' },
]

export default function CustomerCfoClient({
  summary,
  currentWeeks,
}: {
  summary:      CustomerSummary
  currentWeeks: number
}) {
  const router = useRouter()
  const { name, totalRevenue, totalProfit, margin, coveredRevenue, uncoveredRevenue, products, periodLabel } = summary

  const losing   = products.filter(p => p.margin !== null && p.margin < 0)
  const marginal = products.filter(p => p.margin !== null && p.margin >= 0 && p.margin < 0.20)
  const noCost   = products.filter(p => !p.hasCostData)

  const coveragePct = totalRevenue > 0 ? Math.round((coveredRevenue / totalRevenue) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/cfo" className="text-gray-400 text-lg">‹</Link>
        <div className="flex-1">
          <p className="text-xs text-gray-500">Customer P&L</p>
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 mb-4">
        {PERIODS.map(p => (
          <button
            key={p.weeks}
            onClick={() => router.push(`/cfo/customer/${summary.id}?weeks=${p.weeks}`)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentWeeks === p.weeks
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 active:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mb-3">{periodLabel}</p>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Revenue</p>
          <p className="text-base font-bold text-gray-900">{fmt(totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Profit*</p>
          <p className={`text-base font-bold ${totalProfit < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {fmt(totalProfit)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Margin*</p>
          <p className={`text-base font-bold ${
            margin === null ? 'text-gray-400'
            : margin < 0 ? 'text-red-600'
            : margin < 0.20 ? 'text-amber-600'
            : 'text-green-700'
          }`}>
            {margin !== null ? pct(margin) : '—'}
          </p>
        </div>
      </div>

      {/* Data coverage warning */}
      {uncoveredRevenue > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-600">
            * Based on {coveragePct}% of revenue ({fmt(coveredRevenue)}).{' '}
            <span className="text-gray-400">{fmt(uncoveredRevenue)} has no purchase cost data — import missing invoices for the full picture.</span>
          </p>
        </div>
      )}

      {/* Losing money */}
      {losing.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-bold text-red-700 mb-2">🔴 Selling below cost</p>
          {losing.map(p => (
            <div key={p.name} className="flex items-baseline justify-between py-0.5">
              <span className="text-sm text-gray-900">{p.name}</span>
              <div className="text-right">
                <span className="text-xs text-red-600 font-semibold">{pct(p.margin!)}</span>
                <span className="text-[10px] text-red-400 ml-1.5">
                  sell {fmt(p.avgSellPerBox)}/box · cost {fmt(p.avgBuyPerBox!)}/box
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Thin margin */}
      {marginal.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-700 mb-2">⚠ Below 20% margin</p>
          {marginal.map(p => (
            <div key={p.name} className="flex items-baseline justify-between py-0.5">
              <span className="text-sm text-gray-900">{p.name}</span>
              <span className="text-[10px] text-amber-600">
                {pct(p.margin!)} · sell {fmt(p.avgSellPerBox)}/box · cost {fmt(p.avgBuyPerBox!)}/box
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Full product breakdown */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">All products</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {products.map((p, i) => (
            <div key={p.name} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm flex-1 text-gray-900 font-medium">{p.name}</span>
                <span className="text-xs font-semibold text-gray-700">{fmt(p.totalRevenue)}</span>
                <MarginBar margin={p.margin} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] text-gray-400">{p.totalQty} boxes · {p.orderCount} orders</span>
                {p.hasCostData ? (
                  <span className="text-[9px] text-gray-400">
                    sell {fmt(p.avgSellPerBox)}/box · cost {fmt(p.avgBuyPerBox!)}/box
                    {p.profitPence !== null && (
                      <span className={p.profitPence >= 0 ? ' text-green-600' : ' text-red-600'}>
                        {' '}· profit {fmt(p.profitPence)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[9px] text-amber-500 italic">no cost data</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* No-cost items summary */}
      {noCost.length > 0 && (
        <p className="text-[9px] text-gray-400 text-center mb-4">
          {noCost.length} products missing cost data: {noCost.map(p => p.name).join(', ')}
        </p>
      )}
    </div>
  )
}
