import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { regenerateSuggestions } from '@/lib/pricing-engine'

// Headless equivalent of the "Recalculate all from current costs" button on /pricing.
// Token-protected (same scheme as /api/integrity-check and /api/golem). Rebuilds all
// pending/withheld price suggestions from current product costs via the real engine —
// no SQL re-implementation, so it can never drift from what the UI button does.
//
//   curl -s -X POST "http://localhost:3100/api/recalc-pricing?token=$TOKEN"
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()
  try {
    await regenerateSuggestions(supabase)
    const { count } = await supabase
      .from('price_suggestions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'withheld'])
    return NextResponse.json({ ok: true, pending_after: count ?? 0 })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[RecalcPricing] crashed:', err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
