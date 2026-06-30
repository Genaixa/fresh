// IMAP → invoice-ingest poller — the Postmark replacement, IMAP edition.
//
// WHY THIS EXISTS
// ---------------
// Suppliers email their delivery notes / invoices to sales@freshnfruityghd.com.
// Postmark's free inbound tier caps at 100/mo and on 29 Jun 2026 it silently
// stopped at 08:43, dropping 7 invoices. This reads the mailbox directly and feeds
// the EXACT SAME /api/delivery-note webhook, so downstream behaviour (parse →
// supplier resolve → item match → autoConfirm → price suggestions → Telegram) is
// unchanged.
//
// WHY IMAP (not a Google service account)
// ---------------------------------------
// Google now enforces `iam.disableServiceAccountKeyCreation` as a Secure-by-Default
// constraint even on org-less personal projects, so a service-account JSON key can't
// be minted on this account and there's no org node to turn it off. IMAP + an app
// password sidesteps GCP entirely: the Workspace admin enables IMAP, the sales@
// account generates a 16-char app password, and we log in directly.
// See scripts/GMAIL_INGEST_SETUP.md.
//
// SAFETY
// ------
//  • Idempotent: each message's RFC822 Message-ID is recorded in a local state file
//    after a successful POST; already-seen IDs are skipped. The webhook's own dedup
//    (same supplier+date+items → skip; same ticket number → keep fuller copy) makes
//    any re-feed harmless even if the state file is lost.
//  • Conservative: only the automated supplier senders; statements / collection
//    notices are excluded so they never become junk invoices.
//
// USAGE
//   node scripts/imap-ingest.mjs              # sweep + ingest
//   node scripts/imap-ingest.mjs --dry-run    # list what WOULD be ingested, change nothing
//   node scripts/imap-ingest.mjs --since 7d   # widen the lookback window (default 3d)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// ---- config -------------------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SINCE = (() => {
  const i = args.indexOf('--since')
  return i >= 0 && args[i + 1] ? args[i + 1] : '3d'
})()

// Resolve .env.local relative to the project root (one level above scripts/) so the
// poller works from any cwd — cron runs it from $HOME, not the project dir.
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

const HOST = env.GMAIL_INGEST_IMAP_HOST || 'imap.gmail.com'
const PORT = Number(env.GMAIL_INGEST_IMAP_PORT || 993)
const USER = env.GMAIL_INGEST_USER || env.GMAIL_INGEST_SUBJECT || 'sales@freshnfruityghd.com'
const PASS = env.GMAIL_INGEST_APP_PASSWORD            // 16-char Google app password (spaces optional)
const WEBHOOK_SECRET = env.POSTMARK_WEBHOOK_SECRET
const WEBHOOK_URL = (env.GMAIL_INGEST_WEBHOOK || 'http://localhost:3100/api/delivery-note') + `?token=${encodeURIComponent(WEBHOOK_SECRET || '')}`
const STATE_PATH = new URL('./.imap-ingest-state.json', import.meta.url).pathname
const STATE_CAP = 2000                                 // keep the most recent N processed IDs
// Heartbeat: stamped on every sweep that reaches the mailbox without a fatal error.
// A separate cron (imap-healthcheck.mjs) alerts if this goes stale — that catches the
// failure class the in-script alert can't, i.e. the poller dying BEFORE node loads it
// (wrong cron path, node missing, etc), which is exactly what broke it on 30 Jun.
const HEARTBEAT_PATH = new URL('./.imap-ingest-heartbeat.json', import.meta.url).pathname
// External uptime monitor (e.g. healthchecks.io). The local heartbeat + healthcheck can't
// see the box itself dying (power off, cron daemon dead, disk full). This pings an OFF-box
// URL on every successful sweep; if the pings stop, THEIR servers alert you. Optional —
// set HEALTHCHECK_PING_URL in .env.local to enable. Fire-and-forget; never blocks ingest.
const UPTIME_PING_URL = env.HEALTHCHECK_PING_URL || ''
async function pingUptime(suffix = '') {
  if (!UPTIME_PING_URL || DRY_RUN) return
  try { await fetch(UPTIME_PING_URL + suffix, { method: 'GET', signal: AbortSignal.timeout(10_000) }) }
  catch (err) { console.error('[uptime] ping failed:', err.message) }   // non-fatal; the local alert still covers it
}

// ---- failure alerting (reuses the pipeline's Telegram bot) --------------------------
const TG_TOKEN = env.TELEGRAM_BOT_TOKEN
const TG_CHAT = env.TELEGRAM_CHAT_ID
const ALERT_PATH = new URL('./.imap-ingest-alert.json', import.meta.url).pathname
const ALERT_THROTTLE_MS = 6 * 3600_000                 // at most one alert per 6h so a persistent break doesn't spam every 15 min

async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT) return false
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
    })
    return r.ok
  } catch (err) { console.error('[Telegram] send failed:', err.message); return false }
}

async function notifyFailure(text) {
  if (DRY_RUN) return
  try {                                                // throttle on last-sent timestamp
    const last = JSON.parse(readFileSync(ALERT_PATH, 'utf8')).lastAlert || 0
    if (Date.now() - last < ALERT_THROTTLE_MS) return
  } catch { /* no prior alert file → send */ }
  try { writeFileSync(ALERT_PATH, JSON.stringify({ lastAlert: Date.now() })) } catch { /* ignore */ }
  await tgSend(text)
}

// --test-alert: verify wiring end-to-end with a clearly-labelled message (bypasses throttle).
if (args.includes('--test-alert')) {
  if (!TG_TOKEN || !TG_CHAT) { console.error('✗ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing from .env.local'); process.exit(1) }
  const ok = await tgSend('✅ <b>Invoice-ingest alerts are live.</b> If the mailbox poller ever fails (e.g. the sales@ app password is revoked), you’ll get a message here within ~15 min. This is just a test — nothing is wrong.')
  console.log(ok ? 'test-alert sent ✓' : 'test-alert FAILED — check token/chat id')
  process.exit(ok ? 0 : 1)
}

// Only the automated supplier senders that send delivery notes / invoices.
// Statements & collection notices (e.g. Kath@jrholland) are NOT delivery docs — excluded.
const ALLOWED_DOMAINS = ['totalproduce.com', 'jrholland.co.uk', 'thomasbaty.co.uk', 'themilkcompany.co.uk']
// JR Holland finance staff (statements / direct-debit notices) are NOT delivery docs.
const EXCLUDE_FROM = ['kath@jrholland.co.uk', 'nicola@jrholland.co.uk']
const EXCLUDE_SUBJECT = [/statement/i, /collection/i, /direct debit/i, /remittance/i]

if (!WEBHOOK_SECRET) { console.error('✗ POSTMARK_WEBHOOK_SECRET missing from .env.local'); process.exit(1) }
if (!PASS) { console.error('✗ GMAIL_INGEST_APP_PASSWORD missing from .env.local. See scripts/GMAIL_INGEST_SETUP.md'); process.exit(1) }

// ---- dedup state --------------------------------------------------------------------
function loadState() {
  try { return new Set(JSON.parse(readFileSync(STATE_PATH, 'utf8'))) }
  catch { return new Set() }
}
function saveState(set) {
  // keep insertion order, trim to the most recent STATE_CAP ids
  const arr = [...set].slice(-STATE_CAP)
  writeFileSync(STATE_PATH, JSON.stringify(arr))
}

// ---- helpers ------------------------------------------------------------------------
function sinceDate(spec) {
  const m = /^(\d+)\s*([dwh])$/i.exec(spec.trim())
  const now = Date.now()
  if (!m) return new Date(now - 3 * 86400_000)
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const ms = unit === 'h' ? 3600_000 : unit === 'w' ? 7 * 86400_000 : 86400_000
  return new Date(now - n * ms)
}

const fromAddress = parsed =>
  (parsed.from?.value?.[0]?.address || '').toLowerCase()

function isWantedSender(addr) {
  if (!addr) return false
  if (EXCLUDE_FROM.includes(addr)) return false
  const domain = addr.split('@')[1] || ''
  return ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
}

const isExcludedSubject = subject => EXCLUDE_SUBJECT.some(re => re.test(subject || ''))

// Thomas Baty sends line-item "DespatchNotes" (the real costed deliveries) AND
// "ConsolInvoice"/blank-subject summaries (period totals, no usable product lines,
// which double-count the despatch notes). Only ingest the despatch notes.
function isExcludedForSupplier(addr, subject) {
  const domain = addr.split('@')[1] || ''
  if (domain === 'thomasbaty.co.uk' || domain.endsWith('.thomasbaty.co.uk')) {
    return !/despatch/i.test(subject || '')
  }
  return false
}

// ---- main ---------------------------------------------------------------------------
const summary = { scanned: 0, ingested: 0, skipped: 0, failed: 0, pdfs: 0 }
const processed = loadState()

const client = new ImapFlow({
  host: HOST,
  port: PORT,
  secure: true,
  auth: { user: USER, pass: PASS.replace(/\s+/g, '') },  // app passwords are shown with spaces; strip them
  logger: false,
})

try {
  await client.connect()
} catch (err) {
  console.error(`✗ IMAP login failed for ${USER}: ${err.message}`)
  console.error('  → Check: IMAP enabled in Workspace admin, 2-step verification on, app password correct. See setup doc.')
  await notifyFailure(`🔴 <b>Invoice ingest DOWN</b>\nIMAP login to ${USER} failed: ${err.message}\nLikely the app password was revoked or 2-Step was reset. Supplier invoices are NOT being read until this is fixed.`)
  process.exit(1)
}

const lock = await client.getMailboxLock('INBOX')
console.log(`Mailbox: ${USER}@${HOST}  |  since: ${SINCE}${DRY_RUN ? '  |  DRY-RUN' : ''}`)

let runError = null
try {
  const uids = await client.search({ since: sinceDate(SINCE) }, { uid: true })
  console.log(`Found ${uids.length} message(s) in the lookback window.`)

  for (const uid of uids) {
    summary.scanned++
    try {
      const { content } = await client.download(uid, undefined, { uid: true })
      const parsed = await simpleParser(content)

      const from = parsed.from?.text || ''
      const addr = fromAddress(parsed)
      const subject = parsed.subject || ''
      const messageId = parsed.messageId || `uid:${uid}`

      if (processed.has(messageId)) { summary.skipped++; continue }
      if (!isWantedSender(addr)) { summary.skipped++; continue }
      if (isExcludedSubject(subject)) { console.log(`  – "${subject}" — excluded subject, skip`); summary.skipped++; continue }
      if (isExcludedForSupplier(addr, subject)) { console.log(`  – "${subject}" from ${addr} — Baty non-despatch (consol/summary), skip`); summary.skipped++; continue }

      const pdfs = (parsed.attachments || []).filter(a =>
        a.contentType === 'application/pdf' || (a.filename || '').toLowerCase().endsWith('.pdf'))
      if (pdfs.length === 0) { console.log(`  – "${subject}" from ${addr} — no PDF, skip`); summary.skipped++; continue }

      const Attachments = pdfs.map(a => {
        summary.pdfs++
        return {
          Name: a.filename || 'attachment.pdf',
          Content: a.content.toString('base64'),
          ContentType: 'application/pdf',
          ContentLength: a.size || a.content.length || 0,
        }
      })

      if (DRY_RUN) {
        console.log(`  • WOULD ingest: "${subject}" from ${from} (${Attachments.length} PDF)`)
        summary.ingested++
        continue
      }

      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ From: from, Subject: subject, MessageID: messageId, Attachments }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) { console.error(`  ✗ webhook ${res.status} for "${subject}": ${JSON.stringify(out)}`); summary.failed++; continue }

      processed.add(messageId)
      saveState(processed)
      console.log(`  ✓ ingested "${subject}" (webhook processed=${out.processed})`)
      summary.ingested++
    } catch (err) {
      console.error(`  ✗ uid ${uid}: ${err.message}`)
      summary.failed++
    }
  }
} catch (err) {
  runError = err
  console.error(`✗ ingest run aborted: ${err.message}`)
} finally {
  lock.release()
  await client.logout()
}

console.log(`\nDone. scanned=${summary.scanned} ingested=${summary.ingested} skipped=${summary.skipped} failed=${summary.failed} pdfs=${summary.pdfs}`)

// Stamp the heartbeat whenever the poller reached the mailbox and finished a sweep.
// Per-message webhook failures (alerted separately) do NOT mean the poller is dead, so
// they still count as a live heartbeat; only a fatal runError suppresses it.
if (!runError && !DRY_RUN) {
  try { writeFileSync(HEARTBEAT_PATH, JSON.stringify({ ts: Date.now(), scanned: summary.scanned, ingested: summary.ingested })) }
  catch (err) { console.error('[heartbeat] write failed:', err.message) }
}

if (runError) {
  await notifyFailure(`🔴 <b>Invoice ingest error</b>\nRun aborted: ${runError.message}`)
  await pingUptime('/fail')                 // tell the off-box monitor immediately, don't wait for the silence to time out
} else if (summary.failed > 0) {
  await notifyFailure(`⚠️ <b>Invoice ingest</b>: ${summary.failed} message(s) failed to reach the webhook this run (scanned ${summary.scanned}, ingested ${summary.ingested}). Check logs/gmail-ingest.log.`)
  await pingUptime()                        // poller itself is healthy (it swept the mailbox); webhook hiccup is alerted separately
} else {
  await pingUptime()                        // clean sweep → signal the off-box monitor we're alive
}
process.exit(runError || summary.failed > 0 ? 1 : 0)
