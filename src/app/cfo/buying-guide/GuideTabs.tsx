'use client'

import { useState } from 'react'

export type GuideRow = {
  name: string; cost: number; retail: number; marginPct: number; ratio: number
  weeklyUnits: number; weeklyProfit: number
}

const u = (p: number) => p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`

function EarnRow({ r }: { r: GuideRow }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{r.name}</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          sells ~{r.weeklyUnits}/wk · cost {u(r.cost)} · sell {u(r.retail)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-status-green leading-tight tabular-nums">£{Math.round(r.weeklyProfit / 100)}<span className="text-[10px] font-normal text-[var(--text-muted)]">/wk</span></p>
        <p className="text-[10px] tabular-nums text-[var(--text-muted)]">{Math.round(r.marginPct * 100)}%</p>
      </div>
    </div>
  )
}

function MarginRow({ r, muted }: { r: GuideRow; muted?: boolean }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{r.name}</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          cost {u(r.cost)} · sell {u(r.retail)} · £1 in → £{r.ratio.toFixed(2)} back
        </p>
      </div>
      <p className={`font-bold text-sm shrink-0 tabular-nums ${muted ? 'text-[var(--text-muted)]' : 'text-status-green'}`}>{Math.round(r.marginPct * 100)}%</p>
    </div>
  )
}

const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-[var(--bg-card)] divide-y divide-white/5 overflow-hidden">{children}</div>
)

type TabId = 'big' | 'steady' | 'small' | 'other'

export function GuideTabs({ big, steady, small, noVolume, lossLeaders }: {
  big: GuideRow[]; steady: GuideRow[]; small: GuideRow[]
  noVolume: GuideRow[]; lossLeaders: GuideRow[]
}) {
  const [tab, setTab] = useState<TabId>('big')
  const otherCount = noVolume.length + lossLeaders.length

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'big',    label: '💰 Big',   count: big.length },
    { id: 'steady', label: 'Steady',   count: steady.length },
    { id: 'small',  label: 'Small',    count: small.length },
    { id: 'other',  label: 'Other',    count: otherCount },
  ]

  return (
    <section className="mb-6">
      <div className="flex gap-1 mb-2 bg-white/5 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
              tab === t.id ? 'bg-white/15 text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}>
            {t.label} <span className="opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'big' && (
        <>
          <p className="text-xs text-[var(--text-muted)] mb-2">£25+ a week — these pay the bills. Keep them stocked and protect their prices.</p>
          <Table>{big.map(r => <EarnRow key={r.name} r={r} />)}</Table>
        </>
      )}

      {tab === 'steady' && (
        <>
          <p className="text-xs text-[var(--text-muted)] mb-2">£5–25 a week.</p>
          <Table>{steady.map(r => <EarnRow key={r.name} r={r} />)}</Table>
        </>
      )}

      {tab === 'small' && (
        <>
          <p className="text-xs text-[var(--text-muted)] mb-2">Under £5 a week — healthy margins, just slow sellers. Fine to stock, not where the money is.</p>
          <Table>{small.map(r => <EarnRow key={r.name} r={r} />)}</Table>
        </>
      )}

      {tab === 'other' && (
        <div className="space-y-4">
          {noVolume.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">No sales-rate data yet — the till doesn&apos;t track how fast these sell, so only the per-sale margin is shown.</p>
              <Table>{noVolume.map(r => <MarginRow key={r.name} r={r} />)}</Table>
            </div>
          )}
          {lossLeaders.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">Loss-leaders (on purpose) — kept cheap to pull customers in.</p>
              <Table>{lossLeaders.map(r => <MarginRow key={r.name} r={r} muted />)}</Table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
