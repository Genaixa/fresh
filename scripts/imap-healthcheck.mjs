// IMAP-ingest healthcheck — the watcher for the watcher.
//
// WHY THIS EXISTS
// ---------------
// imap-ingest.mjs alerts on Telegram when a sweep fails. But that alert lives INSIDE
// the script, so any crash BEFORE node loads it is invisible — which is exactly how the
// poller died silently for ~19h on 30 Jun 2026 (a relative path in the crontab meant
// `node scripts/imap-ingest.mjs` ran from /root and never resolved the module).
//
// This script watches the heartbeat file the ingest stamps after every successful sweep.
// If the heartbeat is missing or older than STALE_MS, it fires one throttled Telegram
// alert. It has NO dependency on imapflow/mailparser and does NOT touch the mailbox —
// it's deliberately tiny so it can't fail the same way the thing it watches did.
//
// USAGE
//   node scripts/imap-healthcheck.mjs              # check; alert if stale
//   node scripts/imap-healthcheck.mjs --test-alert # send a labelled test message, then exit

import { readFileSync, writeFileSync } from 'fs'

const args = process.argv.slice(2)

// ---- config -------------------------------------------------------------------------
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname
const env = {}
try {
  readFileSync(ENV_PATH, 'utf8').split('\n').forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  })
} catch { /* fall through to env checks below */ }

const TG_TOKEN = env.TELEGRAM_BOT_TOKEN
const TG_CHAT = env.TELEGRAM_CHAT_ID
const HEARTBEAT_PATH = new URL('./.imap-ingest-heartbeat.json', import.meta.url).pathname
const ALERT_PATH = new URL('./.imap-healthcheck-alert.json', import.meta.url).pathname
const STALE_MS = 2 * 3600_000          // alert if no successful sweep in 2h (≈8 missed 15-min runs)
const ALERT_THROTTLE_MS = 6 * 3600_000 // at most one alert per 6h so a persistent break doesn't spam

async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT) { console.error('✗ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing from .env.local'); return false }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
    })
    return r.ok
  } catch (err) { console.error('[Telegram] send failed:', err.message); return false }
}

// --test-alert: prove the wiring end-to-end (bypasses throttle).
if (args.includes('--test-alert')) {
  const ok = await tgSend('✅ <b>Invoice-ingest healthcheck is live.</b> If the mailbox poller ever stops running entirely — even crashing before it can alert you — you’ll get a warning here. This is just a test; nothing is wrong.')
  console.log(ok ? 'test-alert sent ✓' : 'test-alert FAILED — check token/chat id')
  process.exit(ok ? 0 : 1)
}

// ---- read heartbeat -----------------------------------------------------------------
let lastTs = 0
try { lastTs = Number(JSON.parse(readFileSync(HEARTBEAT_PATH, 'utf8')).ts) || 0 }
catch { lastTs = 0 }   // missing/corrupt heartbeat = treat as stale

const ageMs = Date.now() - lastTs
const stale = !lastTs || ageMs > STALE_MS

if (!stale) {
  console.log(`OK — last successful sweep ${Math.round(ageMs / 60_000)} min ago.`)
  process.exit(0)
}

// ---- throttle so a multi-hour outage sends one alert, not one per check --------------
try {
  const last = JSON.parse(readFileSync(ALERT_PATH, 'utf8')).lastAlert || 0
  if (Date.now() - last < ALERT_THROTTLE_MS) {
    console.log('Stale, but within alert throttle window — not re-sending.')
    process.exit(1)
  }
} catch { /* no prior alert → send */ }

const ageDesc = lastTs ? `${Math.round(ageMs / 3600_000 * 10) / 10}h ago` : 'never (no heartbeat file)'
const ok = await tgSend(
  `🔴 <b>Invoice ingest may be DOWN</b>\nLast successful mailbox sweep: <b>${ageDesc}</b> (threshold 2h).\n` +
  `The 15-min poller isn't completing — invoices could be piling up unread.\n` +
  `Check <code>logs/gmail-ingest.log</code> and the crontab on the server.`,
)
try { writeFileSync(ALERT_PATH, JSON.stringify({ lastAlert: Date.now() })) } catch { /* ignore */ }
console.log(ok ? `ALERT sent — heartbeat stale (${ageDesc}).` : 'Heartbeat stale but Telegram send FAILED.')
process.exit(1)
