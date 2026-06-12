'use client'

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export type MarginDatum = { name: string; marginPct: number }

function barColour(m: number) {
  if (m < 0)    return '#EF4444' // red
  if (m < 0.20) return '#F59E0B' // amber
  if (m < 0.40) return '#A8D5A8' // light green
  return '#22C55E'               // green
}

// Profit chart: bar LENGTH = estimated £/week the product earns, bar COLOUR =
// margin health. Two dimensions in one picture — answers "where's the money
// coming from" rather than repeating the margin ranking.
export type ProfitDatum = { name: string; profitPence: number; marginPct: number }

export function ProfitChart({ data }: { data: ProfitDatum[] }) {
  const rows = data.map(d => ({ name: d.name, value: Math.round(d.profitPence / 100), m: d.marginPct }))
  if (rows.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 28)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 34, top: 0, bottom: 0 }}>
        <XAxis type="number" tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10, fill: '#9CA3AF' }}
          axisLine={false} tickLine={false} domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 10, fill: '#D1D5DB' }}
          axisLine={false} tickLine={false} />
        <Tooltip formatter={(v, _n, item) => [`£${Number(v)}/week · ${Math.round((item?.payload?.m ?? 0) * 100)}% margin`, 'Est. profit']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #2f3f2f', background: '#1E2E1E', color: '#fff' }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={15}>
          {rows.map((r, i) => <Cell key={i} fill={barColour(r.m)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Horizontal margin-% bars, themed for the dark CFO surface.
export function MarginChart({ data }: { data: MarginDatum[] }) {
  const rows = data.map(d => ({ name: d.name, value: Math.round(d.marginPct * 100) }))
  if (rows.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 26)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 30, top: 0, bottom: 0 }}>
        <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#9CA3AF' }}
          axisLine={false} tickLine={false} domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: '#D1D5DB' }}
          axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => [`${Number(v)}%`, 'Margin']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #2f3f2f', background: '#1E2E1E', color: '#fff' }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={14}>
          {rows.map((r, i) => <Cell key={i} fill={barColour(r.value / 100)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
