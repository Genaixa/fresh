'use client'

import type { CfoData, CfoProduct } from './page'

const fmt  = (p: number) => `£${(p / 100).toFixed(2)}`
const pct  = (n: number) => `${Math.round(n * 100)}%`
const fmtK = (p: number) => p >= 100000 ? `£${(p / 100000).toFixed(1)}k` : fmt(p)

function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-gray-300 text-xs">—</span>
  const colour = margin < 0 ? 'text-red-600' : margin < 0.20 ? 'text-amber-600' : 'text-green-700'
  return <span className={`text-xs font-semibold ${colour}`}>{pct(margin)}</span>
}

function Delta({ this_, last, format }: { this_: number; last: number; format?: 'money' | 'pct' }) {
  if (!last) return null
  const up = this_ >= last
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

export default function CfoClient({ data }: { data: CfoData }) {
  const { weekLabel, thisWeekSpend, lastWeekSpend, thisWeekRev, thisWeekMargin, lastWeekMargin, products, briefing } = data

  const losing   = products.filter(p => p.margin !== null && p.margin < 0)
  const marginal = products.filter(p => p.margin !== null && p.margin >= 0 && p.margin < 0.20)
  const healthy  = products.filter(p => p.margin !== null && p.margin >= 0.20)

  return (
    <div className="text-gray-900">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">CFO Briefing</h1>
        <p className="text-xs text-gray-500">{weekLabel}</p>
      </div>

      {/* AI briefing */}
      {briefing && (
        <div className="mb-4 rounded-xl border border-green-800 bg-[#0F1A0F] px-3 py-3 flex gap-2 items-start">
          <span className="text-[10px] font-bold text-green-400 mt-0.5 shrink-0">CFO</span>
          <p className="text-xs text-green-100 flex-1 leading-relaxed">{briefing}</p>
        </div>
      )}

      {/* Summary row */}
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

      {/* Marginal products */}
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

      {/* Top spends */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Top spends this week</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {products.slice(0, 12).map((p, i) => (
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

      {/* Healthy products */}
      {healthy.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Good margin this week</p>
          <div className="flex flex-wrap gap-1.5">
            {healthy.map(p => (
              <span key={p.name} className="text-xs bg-green-50 text-green-800 border border-green-200 rounded-full px-2.5 py-1">
                {p.name} <span className="font-semibold">{pct(p.margin!)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-center">* estimated — assumes everything sold at current retail price</p>
    </div>
  )
}
