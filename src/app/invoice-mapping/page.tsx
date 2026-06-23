export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { fuzzyMatchProduct } from '@/lib/invoice-parser'
import { MappingTable } from './MappingTable'

export default async function InvoiceMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ recent?: string }>
}) {
  const { recent } = await searchParams
  const supabase = await createClient()

  // Load ALL statuses so user can come back and re-edit anything
  const { data: mappings } = await supabase
    .from('supplier_product_mappings')
    .select('id, raw_description, supplier_name, status, product_id, unit_type, units_per_case, box_weight_kg, last_price_p, appearances')
    .order('appearances', { ascending: false })
    .range(0, 9999)

  // Which pending descriptions actually arrived on a delivery in the last 14 days —
  // the same "recent" set the dashboard counts. Lets the table focus/highlight the
  // item the dashboard nudge is referring to, instead of the whole backlog.
  const mappingCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: recentUnmatched } = await supabase
    .from('purchase_invoice_items')
    .select('product_name_raw, purchase_invoices!inner(invoice_date)')
    .is('product_id', null)
    .gte('purchase_invoices.invoice_date', mappingCutoff)
    .limit(5000)
  const recentRaws = [...new Set((recentUnmatched ?? []).map(r => r.product_name_raw.toLowerCase()))]

  const { data: products } = await supabase
    .from('products')
    .select('id, name, epos_now_id')
    .eq('is_active', true)
    .order('name')

  const items = mappings ?? []
  const catalogue = products ?? []
  const pendingCount = items.filter(i => i.status === 'pending').length

  // For pending: fuzzy guess. For confirmed: use their confirmed product_id.
  const suggestions: Record<string, string | null> = {}
  for (const item of items) {
    suggestions[item.id] = item.product_id ?? fuzzyMatchProduct(item.raw_description, catalogue)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Map Products</h1>
          <p className="text-sm text-gray-400">
            Match delivery descriptions to your product list
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-status-red text-white text-sm font-bold
                           rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
            {pendingCount}
          </span>
        )}
      </div>

      <MappingTable items={items} catalogue={catalogue} suggestions={suggestions}
        recentRaws={recentRaws} focusRecent={recent === '1'} />
    </div>
    </div>
  )
}
