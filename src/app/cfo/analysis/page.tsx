import { topCustomers } from '@/lib/cfo-queries'
import { ShellBar } from '@/components/fiori/ShellBar'
import { FilterBar } from '@/components/fiori/FilterBar'
import { DashboardGrid } from '@/components/fiori/DashboardGrid'
import { KpiTile } from '@/components/fiori/tiles/KpiTile'
import { TopCustomersTile } from '@/components/fiori/tiles/TopCustomersTile'
import { SalesByQuarterSample, SalesByCategorySample } from '@/components/fiori/tiles/SampleTiles'

export const dynamic = 'force-dynamic'

const money = (p: number) => `£${Math.round(p / 100).toLocaleString('en-GB')}`

export default async function SalesAnalysisPage() {
  const customers  = await topCustomers(12)
  const top10      = customers.slice(0, 10)
  const totalSales = customers.reduce((s, c) => s + c.revenue, 0)

  return (
    <div className="fiori min-h-screen">
      <ShellBar title="Sales Analysis" />
      <FilterBar />
      <main className="p-2">
        <DashboardGrid>
          <KpiTile
            title="Wholesale Sales"
            subtitle="Last 12 weeks"
            value={money(totalSales)}
            foot={`${customers.length} active customer${customers.length === 1 ? '' : 's'}`}
          />
          <TopCustomersTile data={top10} />
          <SalesByQuarterSample />
          <SalesByCategorySample />
        </DashboardGrid>
        <p className="fiori-tile__sub" style={{ marginTop: 8, padding: '0 4px' }}>
          Tiles marked <strong>SAMPLE</strong> use placeholder data — real wiring to follow.
          The KPI and Top&nbsp;10 Customers are live from Supabase.
        </p>
      </main>
    </div>
  )
}
