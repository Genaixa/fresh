'use client'

import Link from 'next/link'
import type { CfoData } from './page'

const fmt  = (p: number) => p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`
const pct  = (n: number) => `${Math.round(n * 100)}%`
const fmtK = (p: number) => p >= 100000 ? `£${(p / 100000).toFixed(1)}k` : `£${(p / 100).toFixed(2)}`

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

export default function CfoClient({ data }: { data: CfoData }) {
  const {
    weekLabel, thisWeekSpend, lastWeekSpend, thisWeekRev, thisWeekMargin, lastWeekMargin,
    products, briefing, reportAlerts, reportWinners, outstanding,
  } = data

  const losing = products.filter(p => p.margin !== null && p.margin < 0)
  const totalOwed = outstanding.reduce((s, o) => s + o.balance, 0)

  return (
    <div className="text-gray-900">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">CFO Briefing</h1>
        <p className="text-xs text-gray-500">{weekLabel}</p>
      </div>

      {/* This-week KPIs */}
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

      {/* ── ATTENTION ─────────────────────────────────────────── */}

      {/* Price fixes needed (from catalogue margins) */}
      {reportAlerts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
            ⚠ Price fixes needed ({reportAlerts.length})
          </p>
          <div className="rounded-xl border border-red-200 overflow-hidden">
            {reportAlerts.map((a, i) => (
              <div key={a.name} className={`px-3 py-2.5 ${i > 0 ? 'border-t border-red-100' : ''} ${a.margin < 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                  <span className={`text-xs font-bold ${a.margin < 0 ? 'text-red-600' : 'text-amber-700'}`}>{pct(a.margin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">cost {fmt(a.purchase_cost)} · sell {fmt(a.retail_price)}</span>
                  <span className="text-[10px] font-semibold text-green-700">→ raise to {fmt(a.suggested_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Losing money on this week's actual buys */}
      {losing.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-bold text-red-700 mb-2">🔴 Losing money on this week's buys</p>
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

      {reportAlerts.length === 0 && losing.length === 0 && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-green-700">✓ All prices above margin floor</p>
        </div>
      )}

      {/* ── MONEY OWED (AR snapshot) ───────────────────────────── */}
      {outstanding.length > 0 && (
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              💷 Money owed · {fmt(totalOwed)}
            </p>
            <Link href="/wholesale/customers" className="text-xs text-[#0a6ed1] font-medium">See all →</Link>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {outstanding.map((o, i) => (
              <Link key={o.id} href={`/wholesale/customers/${o.id}`}
                className={`flex items-center justify-between px-3 py-2.5 active:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <span className="text-sm text-gray-900">{o.name}</span>
                <span className="text-right">
                  <span className="text-sm font-bold text-yellow-600 block leading-tight">{fmt(o.balance)}</span>
                  {o.overdue > 0 && <span className="text-[10px] text-red-500">{fmt(o.overdue)} overdue</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── WINS ──────────────────────────────────────────────── */}
      {reportWinners.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">🏆 Top margin products</p>
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

      {/* ── DOORS ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Link href="/cfo/buying-guide"
          className="block rounded-xl bg-green-50 border border-green-200 px-4 py-3 active:scale-[0.99] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-green-800 text-sm">Where to put your money</p>
              <p className="text-xs text-green-600 mt-0.5">Which products make you money — in plain English</p>
            </div>
            <span className="text-green-700 text-xl ml-3">→</span>
          </div>
        </Link>

        <Link href="/wholesale/customers"
          className="block rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 active:scale-[0.99] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800 text-sm">All accounts</p>
              <p className="text-xs text-gray-500 mt-0.5">Customer ledgers, balances & contact details</p>
            </div>
            <span className="text-gray-500 text-xl ml-3">→</span>
          </div>
        </Link>
      </div>

      <p className="text-[9px] text-gray-400 text-center mt-4">* estimated — assumes everything sold at RRP</p>
    </div>
  )
}
