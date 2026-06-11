import { AnalyticTile } from '../AnalyticTile'

// Big-number KPI tile (Fiori "numeric tile" feel).
export function KpiTile({ title, subtitle, value, foot }: {
  title: string; subtitle?: string; value: string; foot?: string
}) {
  return (
    <AnalyticTile title={title} subtitle={subtitle} details={false} minHeight={180}>
      <div className="flex flex-col justify-center h-full">
        <div className="fiori-kpi">{value}</div>
        {foot && <p className="fiori-tile__sub" style={{ marginTop: 10 }}>{foot}</p>}
      </div>
    </AnalyticTile>
  )
}
