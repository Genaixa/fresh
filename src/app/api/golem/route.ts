import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDailySweep } from '@/lib/data-golem'

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
  const briefing = await runDailySweep(supabase)
  return NextResponse.json({ ok: true, briefing })
}
