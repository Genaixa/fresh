import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseEposMonthlyReport } from '@/lib/epos-sync'

// Relative redirect — building absolute URLs from request.url can carry the
// wrong host (it once bounced the browser to localhost:3100), so send a bare
// Location header and let the browser resolve it against the current origin.
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return seeOther('/login')

    const form = await request.formData()
    const file = form.get('csv') as File | null
    const periodStr = form.get('period') as string | null  // "YYYY-MM"

    if (!file) {
      return seeOther('/sync?error=No+file+uploaded')
    }

    const text = await file.text()
    const { rows, errors } = parseEposMonthlyReport(text)

    if (rows.length === 0) {
      // Surface exactly what arrived so format bugs can be diagnosed from logs
      console.error('[import-sales] rejected upload:', file.name, file.type, file.size, 'bytes; first 600 chars:', JSON.stringify(text.slice(0, 600)))
      const msg = errors.length > 0 ? errors[0] : 'No valid rows found — check file format'
      return seeOther(`/sync?error=${encodeURIComponent(msg)}`)
    }

    // Determine period start (first of the month)
    let periodStart: string
    if (periodStr && /^\d{4}-\d{2}$/.test(periodStr)) {
      periodStart = `${periodStr}-01`
    } else {
      const now = new Date()
      periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    }

    // Replace any existing import for this period
    await supabase
      .from('sales_data')
      .delete()
      .eq('sale_date', periodStart)
      .eq('source', 'epos_month_import')

    // Match products by epos_now_id
    const eposIds = rows.map(r => r.epos_product_id)
    const { data: matchedProducts } = await supabase
      .from('products')
      .select('id, epos_now_id')
      .in('epos_now_id', eposIds)

    const eposToProductId = new Map<string, string>()
    for (const p of (matchedProducts ?? [])) {
      if (p.epos_now_id) eposToProductId.set(p.epos_now_id, p.id)
    }

    const inserts = rows.map(row => ({
      product_id:       eposToProductId.get(row.epos_product_id) ?? null,
      product_name_raw: row.name,
      epos_product_id:  row.epos_product_id,
      quantity_sold:    row.quantity_sold,
      revenue:          row.revenue_pence,
      sale_date:        periodStart,
      source:           'epos_month_import',
    }))

    const { error: insertError } = await supabase.from('sales_data').insert(inserts)

    if (insertError) {
      console.error('Sales import error:', insertError)
      return seeOther(`/sync?error=${encodeURIComponent(insertError.message)}`)
    }

    return seeOther(`/epos-compare?period=${periodStart}`)
  } catch (err) {
    console.error('Import sales unhandled error:', err)
    return seeOther('/sync?error=Import+failed.+Please+try+again.')
  }
}
