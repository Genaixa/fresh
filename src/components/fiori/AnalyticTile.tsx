import type { ReactNode } from 'react'

// Reusable Fiori analytic card: title, optional subtitle, optional badge + "Details" link,
// and a flexible content slot for a chart/table.
export function AnalyticTile({
  title, subtitle, badge, details = true, minHeight, children,
}: {
  title: string
  subtitle?: string
  badge?: ReactNode
  details?: boolean
  minHeight?: number
  children: ReactNode
}) {
  return (
    <section className="fiori-tile" style={minHeight ? { minHeight } : undefined}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="fiori-tile__title truncate">{title}</h3>
            {badge}
          </div>
          {subtitle && <p className="fiori-tile__sub">{subtitle}</p>}
        </div>
        {details && <button type="button" className="fiori-details shrink-0">Details</button>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  )
}

export function SampleChip() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color: '#92500a', background: '#fef0e0',
      border: '1px solid #f7c894', borderRadius: 3, padding: '1px 6px', whiteSpace: 'nowrap',
    }}>SAMPLE</span>
  )
}
