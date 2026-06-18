import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkPricingInvariants } from '@/lib/pricing-invariants'
import { sendTelegram } from '@/lib/telegram'

export async function GET() {
  return NextResponse.json({ ok: true })
}

// Nightly invariant check for the price-suggestion subsystem. Token-protected,
// same scheme as /api/golem. Silent when everything is consistent; pings Telegram
// only when an invariant is violated (the Shomer-canary philosophy: no news = good).
//
// Crontab:
//   0 4 * * * curl -s -X POST "http://localhost:3100/api/integrity-check?token=$TOKEN" >> /root/fresh/logs/integrity-check.log 2>&1
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()
  try {
    const violations = await checkPricingInvariants(supabase)

    if (violations.length > 0) {
      const lines = violations
        .map(v => `• <b>${v.product}</b> [${v.invariant}]\n  ${v.detail}`)
        .join('\n')
      await sendTelegram(
        `🚨 <b>Pricing invariant check — ${violations.length} issue${violations.length === 1 ? '' : 's'}</b>\n` +
        `The pending-suggestion data is internally inconsistent. Tap “Recalculate all from current costs” on /pricing to rebuild.\n\n${lines}`,
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, violations })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[IntegrityCheck] crashed:', err)
    sendTelegram(`❌ <b>Pricing invariant check crashed</b>\n${errMsg}`).catch(() => {})
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
