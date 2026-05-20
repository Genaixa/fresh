'use client'

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList,
  AreaChart, Area, CartesianGrid,
} from 'recharts'

const C = {
  green: '#4A8C4A',
  amber: '#F59E0B',
  red:   '#EF4444',
  muted: '#6B7280',
  bg:    '#1c1c1c',
  border:'rgba(255,255,255,0.08)',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#222',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    fontSize: 12,
    color: '#e5e5e5',
  },
  itemStyle: { color: '#e5e5e5' },
}

export interface ChartProduct {
  name: string
  cost: number           // pence
  price: number          // pence (new/current)
  originalPrice: number  // pence (before any edits)
  marginFloor: number    // e.g. 0.20
}

function getGM(p: ChartProduct) {
  return p.price > 0 && p.cost > 0 ? (p.price - p.cost) / p.price : 0
}
function getMarkup(p: ChartProduct) {
  return p.price > 0 && p.cost > 0 ? (p.price - p.cost) / p.cost * 100 : 0
}
function getColour(p: ChartProduct) {
  const m = getGM(p)
  if (p.price === 0 || p.cost === 0) return C.muted
  if (m >= p.marginFloor) return C.green
  if (m >= p.marginFloor * 0.8) return C.amber
  return C.red
}

interface Props {
  products: ChartProduct[]
  weeklyUnits?: number
  endDate?: string
}

export function MarginCharts({ products, weeklyUnits, endDate }: Props) {
  const priced = products.filter(p => p.cost > 0 && p.price > 0)
  if (!priced.length) return (
    <div className="card text-center text-[var(--text-muted)] text-sm py-8">
      Upload invoices to see charts
    </div>
  )

  // ── Donut ────────────────────────────────────────────────────────────────
  const greenN = priced.filter(p => getGM(p) >= p.marginFloor).length
  const amberN = priced.filter(p => getGM(p) >= p.marginFloor * 0.8 && getGM(p) < p.marginFloor).length
  const redN   = priced.filter(p => getGM(p) < p.marginFloor * 0.8).length

  const donutData = [
    { name: 'On target', value: greenN, color: C.green },
    { name: 'Close',     value: amberN, color: C.amber },
    { name: 'Needs work',value: redN,   color: C.red   },
  ].filter(d => d.value > 0)

  const blendedMarkup = priced.reduce((s, p) => s + getMarkup(p), 0) / priced.length
  const blendedGM     = priced.reduce((s, p) => s + getGM(p), 0)     / priced.length

  // ── Bar chart ─────────────────────────────────────────────────────────────
  const bars = [...priced]
    .map(p => ({
      name:  p.name.length > 17 ? p.name.slice(0, 16) + '…' : p.name,
      value: Math.round(getMarkup(p)),
      fill:  getColour(p),
    }))
    .sort((a, b) => b.value - a.value)

  // ── Projection ────────────────────────────────────────────────────────────
  let projData: { label: string; extra: number }[] = []
  if (weeklyUnits && endDate) {
    const today    = new Date()
    const end      = new Date(endDate)
    const weeks    = Math.max(0, Math.round((end.getTime() - today.getTime()) / (7 * 86400 * 1000)))
    const deltaPerWeek = products.reduce((s, p) => {
      if (p.cost <= 0) return s
      return s + (p.price - p.originalPrice) * weeklyUnits
    }, 0)

    const step = Math.max(1, Math.floor(weeks / 26))
    projData = Array.from({ length: Math.floor(weeks / step) + 1 }, (_, i) => {
      const w = i * step
      return {
        label: w === 0 ? 'Now' : `W${w}`,
        extra: Math.round(deltaPerWeek * w / 100),
      }
    })
  }

  const barHeight = Math.max(200, bars.length * 28)

  return (
    <div className="space-y-4">

      {/* ── Donut + headline stats ─────────────────────────────────────────── */}
      <div className="card flex items-center gap-4">
        <div style={{ width: 110, height: 110, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%" cy="50%"
                innerRadius={34} outerRadius={52}
                dataKey="value"
                animationBegin={0}
                animationDuration={600}
                strokeWidth={0}
              >
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${v} products`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-3xl font-bold text-brand-accent leading-none">
            {blendedMarkup.toFixed(0)}%
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">avg markup</p>
          <p className="text-sm font-semibold mt-1 text-[var(--text)]">
            {(blendedGM * 100).toFixed(1)}% gross margin
          </p>
          <div className="flex gap-3 text-xs mt-2">
            <span className="text-status-green font-medium">{greenN} on target</span>
            {amberN > 0 && <span className="text-status-amber font-medium">{amberN} close</span>}
            {redN > 0   && <span className="text-status-red   font-medium">{redN} low</span>}
          </div>
        </div>
      </div>

      {/* ── Bar chart ─────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-4 pt-3 pb-2">
          Markup by product
        </p>
        <div style={{ height: barHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bars}
              layout="vertical"
              margin={{ left: 4, right: 48, top: 0, bottom: 4 }}
              barCategoryGap="20%"
            >
              <XAxis type="number" hide domain={[0, 'dataMax']} />
              <YAxis
                type="category" dataKey="name"
                width={118}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${v}% markup`, '']}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={600}>
                {bars.map((b, i) => <Cell key={i} fill={b.fill} />)}
                <LabelList
                  dataKey="value"
                  position="right"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => `${v}%`}
                  style={{ fontSize: 11, fill: '#9CA3AF' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Projection area chart ─────────────────────────────────────────── */}
      {projData.length > 1 && (
        <div className="card overflow-hidden p-0">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-4 pt-3 pb-2">
            Cumulative revenue impact
          </p>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projData} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4A8C4A" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#4A8C4A" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="projGradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  axisLine={false} tickLine={false}
                  width={52}
                  tickFormatter={v => v >= 0 ? `£${v}` : `-£${Math.abs(v)}`}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [
                    `${v >= 0 ? '+' : ''}£${Math.abs(v as number).toFixed(2)}`,
                    'Extra revenue',
                  ]}
                  labelFormatter={l => `${l}`}
                />
                <Area
                  type="monotone" dataKey="extra"
                  stroke={projData[projData.length - 1]?.extra >= 0 ? '#4A8C4A' : '#EF4444'}
                  strokeWidth={2}
                  fill={projData[projData.length - 1]?.extra >= 0 ? 'url(#projGrad)' : 'url(#projGradRed)'}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
