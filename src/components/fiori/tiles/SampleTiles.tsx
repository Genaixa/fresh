'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { AnalyticTile, SampleChip } from '../AnalyticTile'

// ───────────────────────────────────────────────────────────────────
// SAMPLE TILES — placeholder data, here to show the Fiori grid layout.
// TODO(slice 2): replace with real Supabase queries (sales by quarter,
// sales by category). Clearly badged SAMPLE so nobody mistakes them for live.
// ───────────────────────────────────────────────────────────────────

const PALETTE = ['#0a6ed1', '#e9730c', '#107e3e', '#ab218e', '#1ea3c2', '#6f42c1', '#f0ab00']

const QUARTER_DATA = [
  { q: 'Q1', Wholesale: 4200, Shop: 3100 },
  { q: 'Q2', Wholesale: 5100, Shop: 3400 },
  { q: 'Q3', Wholesale: 4800, Shop: 3900 },
  { q: 'Q4', Wholesale: 6200, Shop: 4300 },
]

export function SalesByQuarterSample() {
  return (
    <AnalyticTile title="Sales by Quarter" subtitle="Wholesale vs Shop"
      badge={<SampleChip />} details={false} minHeight={320}>
      <ResponsiveContainer width="100%" height={262}>
        <BarChart data={QUARTER_DATA} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="q" tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `£${v / 1000}k`} tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `£${Number(v).toLocaleString('en-GB')}`}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e5e5e5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Wholesale" stackId="a" fill="#0a6ed1" />
          <Bar dataKey="Shop" stackId="a" fill="#e9730c" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AnalyticTile>
  )
}

const CATEGORY_DATA = [
  { name: 'Vegetables', value: 38 },
  { name: 'Fruit', value: 31 },
  { name: 'Salad', value: 14 },
  { name: 'Herbs', value: 9 },
  { name: 'Exotic', value: 8 },
]

export function SalesByCategorySample() {
  return (
    <AnalyticTile title="Sales by Category" subtitle="Share of revenue"
      badge={<SampleChip />} details={false} minHeight={320}>
      <ResponsiveContainer width="100%" height={262}>
        <PieChart>
          <Pie data={CATEGORY_DATA} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1}>
            {CATEGORY_DATA.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => `${Number(v)}%`}
            contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e5e5e5' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </AnalyticTile>
  )
}
