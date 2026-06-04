'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CfoData } from './page'

const fmt  = (p: number) => p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`
const pct  = (n: number) => `${Math.round(n * 100)}%`
const fmtK = (p: number) => p >= 100000 ? `£${(p / 100000).toFixed(1)}k` : `£${(p / 100).toFixed(2)}`

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-gray-300 text-xs">—</span>
  const colour = margin < 0 ? 'text-red-600' : margin < 0.20 ? 'text-amber-600' : 'text-green-700'
  return <span className={`text-xs font-semibold ${colour}`}>{pct(margin)}</span>
}

function Delta({ this_, last, format }: { this_: number; last: number; format?: 'money' | 'pct' }) {
  if (!last) return null
  const up   = this_ >= last
  const diff = this_ - last
  const label = format === 'pct'
    ? `${up ? '+' : ''}${Math.round(diff * 100)}pp`
    : `${up ? '+' : ''}${fmt(Math.abs(diff))}`
  return (
    <span className={`text-[10px] ml-1 ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '↑' : '↓'} {label}
    </span>
  )
}

type Tab = 'overview' | 'products' | 'customers' | 'margins'

export default function CfoClient({ data }: { data: CfoData }) {
  const [tab, setTab] = useState<Tab>('overview')
  const { weekLabel, thisWeekSpend, lastWeekSpend, thisWeekRev, thisWeekMargin, lastWeekMargin, products, briefing, reportAlerts, reportWinners } = data

  const losing   = products.filter(p => p.margin !== null && p.margin < 0)
  const marginal = products.filter(p => p.margin !== null && p.margin >= 0 && p.margin < 0.20)
  const healthy  = products.filter(p => p.margin !== null && p.margin >= 0.20)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'products',  label: 'Products'  },
    { id: 'customers', label: 'Customers' },
    { id: 'margins',   label: 'Margins'   },
  ]

  return (
    <div className="text-gray-900">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold">CFO Briefing</h1>
        <p className="text-xs text-gray-500">{weekLabel}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Spent</p>
              <p className="text-base font-bold">{fmtK(thisWeekSpend)}</p>
              <Delta this_={thisWeekSpend} last={lastWeekSpend} format="money" />
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Revenue*</p>
              <p className="text-base font-bold">{fmtK(thisWeekRev)}</p>
              <p className="text-[9px] text-gray-400">if sold at RRP</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Margin*</p>
              <p className={`text-base font-bold ${thisWeekMargin < 0 ? 'text-red-600' : thisWeekMargin < 0.20 ? 'text-amber-600' : 'text-green-700'}`}>
                {pct(thisWeekMargin)}
              </p>
              <Delta this_={thisWeekMargin} last={lastWeekMargin} format="pct" />
            </div>
          </div>

          {/* AI briefing */}
          {briefing && (
            <div className="mb-4 rounded-xl border border-green-800 bg-[#0F1A0F] px-3 py-3 flex gap-2 items-start">
              <span className="text-[10px] font-bold text-green-400 mt-0.5 shrink-0">CFO</span>
              <p className="text-xs text-green-100 flex-1 leading-relaxed">{briefing}</p>
            </div>
          )}

          {/* Losing money */}
          {losing.length > 0 && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-xs font-bold text-red-700 mb-2">🔴 Losing money this week</p>
              {losing.map(p => (
                <div key={p.name} className="flex items-baseline justify-between py-0.5">
                  <span className="text-sm text-gray-900">{p.name}</span>
                  <span className="text-xs text-red-600 font-medium">
                    cost {fmt(p.costPerUnit)} · sell {fmt(p.retailPerUnit)} · {pct(p.margin!)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Marginal */}
          {marginal.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-bold text-amber-700 mb-2">⚠ Below 20% margin</p>
              {marginal.map(p => (
                <div key={p.name} className="flex items-baseline justify-between py-0.5">
                  <span className="text-sm text-gray-900">{p.name}</span>
                  <span className="text-xs text-amber-700 font-medium">{pct(p.margin!)}</span>
                </div>
              ))}
            </div>
          )}

          {losing.length === 0 && marginal.length === 0 && (
            <p className="text-xs text-green-700">✓ All products above 20% margin</p>
          )}

          <p className="text-[9px] text-gray-400 text-center mt-2">* estimated — assumes everything sold at RRP</p>
        </>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <>
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Top spends this week</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {products.slice(0, 8).map((p, i) => (
                <div key={p.name} className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-[9px] text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-sm flex-1 text-gray-900">{p.name}</span>
                  <span className="text-xs font-semibold text-gray-700">{fmt(p.spend)}</span>
                  <span className="text-[9px] text-gray-400">{p.boxes}bx</span>
                  <MarginBadge margin={p.margin} />
                </div>
              ))}
            </div>
          </div>

          {healthy.length > 0 && (
            <p className="text-xs text-green-700">✓ {healthy.length} products at healthy margin</p>
          )}
        </>
      )}

      {/* Margins tab */}
      {tab === 'margins' && (
        <>
          {/* Alerts */}
          {reportAlerts.length === 0 ? (
            <div className="card text-center py-8 mb-4">
              <p className="text-3xl mb-2">✓</p>
              <p className="text-sm font-semibold text-green-700">All prices above margin floor</p>
            </div>
          ) : (
            <div className="mb-5">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                ⚠ Price fixes needed ({reportAlerts.length})
              </p>
              <div className="rounded-xl border border-red-200 overflow-hidden">
                {reportAlerts.map((a, i) => (
                  <div key={a.name} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-red-100' : ''} ${a.margin < 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                      <span className={`text-xs font-bold ${a.margin < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {pct(a.margin)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">
                        cost {fmt(a.purchase_cost)} · sell {fmt(a.retail_price)}
                      </span>
                      <span className="text-[10px] font-semibold text-green-700">
                        → raise to {fmt(a.suggested_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Winners */}
          {reportWinners.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                🏆 Top margin products
              </p>
              <div className="rounded-xl border border-green-200 overflow-hidden">
                {reportWinners.map((w, i) => (
                  <div key={w.name} className={`flex items-center justify-between px-3 py-2.5 bg-green-50 ${i > 0 ? 'border-t border-green-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-green-400 w-4 text-right">{i + 1}</span>
                      <span className="text-sm text-gray-900">{w.name}</span>
                    </div>
                    <span className="text-xs font-bold text-green-700">{pct(w.margin)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Customers tab */}
      {tab === 'customers' && data.customers && data.customers.length > 0 && (
        <div className="mb-4">
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {data.customers.filter(c => c.revenue > 0).map((c, i) => (
              <Link
                key={c.id}
                href={`/cfo/customer/${c.id}`}
                className={`flex items-center justify-between px-3 py-3 active:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-[9px] text-gray-400">{c.orderCount} orders · {fmt(c.revenue)} revenue</p>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </Link>
            ))}
            {(() => {
              const inactive   = data.customers.filter(c => c.revenue === 0)
              const activeCount = data.customers.filter(c => c.revenue > 0).length
              if (!inactive.length) return null
              return (
                <p className={`text-xs text-gray-400 px-3 py-2.5 ${activeCount > 0 ? 'border-t border-gray-100' : ''}`}>
                  {inactive.length} customer{inactive.length !== 1 ? 's' : ''} — no orders yet
                </p>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
