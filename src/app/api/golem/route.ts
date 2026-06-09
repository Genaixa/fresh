import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDailySweep } from '@/lib/data-golem'
import { sendTelegram } from '@/lib/telegram'

export async function GET() {
  return NextResponse.json({ ok: true })
}

// Called by cron or manually — runs the full daily sweep
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createServiceClient()
  try {
    const briefing = await runDailySweep(supabase)
    return NextResponse.json({ ok: true, briefing })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[DataGolem] daily sweep crashed:', err)
    sendTelegram(`❌ <b>Data Golem crashed</b>\nDaily sweep failed — data quality checks did not run.\n${errMsg}`).catch(() => {})
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
