import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkPricingInvariants } from '@/lib/pricing-invariants'
import { checkInvoiceHygiene } from '@/lib/invoice-hygiene'
import { resolveOpenQuestions } from '@/lib/david-questions'
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

    // ── Invoice / mapping data-hygiene golem (misdated tickets, stale caches, bad arithmetic) ──
    const hygiene = await checkInvoiceHygiene(supabase)
    if (hygiene.length > 0) {
      const shown = hygiene.slice(0, 30)
      const lines = shown
        .map(f => `• [${f.check}] <b>${f.ref}</b>\n  ${f.detail}`)
        .join('\n')
      const more = hygiene.length > shown.length ? `\n…and ${hygiene.length - shown.length} more.` : ''
      await sendTelegram(
        `🧹 <b>Invoice hygiene — ${hygiene.length} issue${hygiene.length === 1 ? '' : 's'}</b>\n` +
        `Recorded delivery-note data looks off. Review on /invoices (and supplier mappings).\n\n${lines}${more}`,
      ).catch(() => {})
    }

    // ── David question ledger — auto-resolve what data can answer, so he's
    //    only ever asked genuine unknowns. Alerts only when something was
    //    auto-closed (a question we no longer need to bother him with).
    const ledger = await resolveOpenQuestions(supabase)
    if (ledger.autoResolved.length > 0) {
      const lines = ledger.autoResolved
        .slice(0, 20)
        .map(r => `• <b>${r.question}</b>\n  → ${r.proposed}\n  <i>${r.evidence}</i>`)
        .join('\n')
      await sendTelegram(
        `🧠 <b>Question ledger — ${ledger.autoResolved.length} auto-resolved</b>\n` +
        `Data now answers these, so David doesn't need to. ${ledger.stillOpen.length} still need him.\n\n${lines}`,
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, violations, hygiene, ledger })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[IntegrityCheck] crashed:', err)
    sendTelegram(`❌ <b>Pricing invariant check crashed</b>\n${errMsg}`).catch(() => {})
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
