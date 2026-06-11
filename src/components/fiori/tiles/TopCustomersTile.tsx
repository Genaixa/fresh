'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AnalyticTile } from '../AnalyticTile'
import type { TopCustomer } from '@/lib/cfo-queries'

const PALETTE = ['#0a6ed1', '#e9730c', '#107e3e', '#ab218e', '#1ea3c2', '#6f42c1', '#f0ab00', '#bb0000', '#5b738b', '#925ace']
const money = (p: number) => `£${Math.round(p / 100).toLocaleString('en-GB')}`

// REAL DATA — wholesale sales by customer, last 12 weeks, from Supabase.
export function TopCustomersTile({ data }: { data: TopCustomer[] }) {
  const rows = data.map(c => ({ name: c.name, value: c.revenue }))
  return (
    <AnalyticTile title="Top 10 Customers" subtitle="Sales · last 12 weeks" minHeight={320}>
      {rows.length === 0 ? (
        <div className="h-full grid place-items-center fiori-tile__sub">No sales in range</div>
      ) : (
        <ResponsiveContainer width="100%" height={262}>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 0 }}>
            <XAxis type="number" tickFormatter={money} tick={{ fontSize: 11, fill: '#6a6d70' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11, fill: '#32363a' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [money(Number(v)), 'Sales']} cursor={{ fill: 'rgba(10,110,209,0.06)' }}
              contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #e5e5e5' }} />
            <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={16}>
              {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </AnalyticTile>
  )
}
