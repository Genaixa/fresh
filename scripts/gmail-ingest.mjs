// Gmail → invoice-ingest poller — the replacement for the Postmark inbound webhook.
//
// WHY THIS EXISTS
// ---------------
// Suppliers email their delivery notes / invoices straight to sales@freshnfruityghd.com.
// We used to forward every one to Postmark's inbound parse, which POSTed it to
// /api/delivery-note. Postmark's free tier caps at 100 send+receive per month, and on
// 29 Jun 2026 we hit it at 08:43 — after which inbound SILENTLY stopped and 7 invoices
// never got parsed. This script removes Postmark from the loop entirely: it reads the
// mailbox directly and feeds the EXACT SAME webhook, so behaviour (parse → supplier
// resolve → item match → autoConfirm → price suggestions → Telegram) is unchanged.
//
// SAFETY
// ------
//  • Idempotent: a message is only acted on once. After a successful POST we stamp it
//    with the "FreshIngested" Gmail label and skip anything already labelled.
//  • Even without the label, the webhook's own dedup (same supplier + date + same item
//    set → skip; same ticket number → keep the fuller copy) makes re-feeding harmless.
//  • Conservative query: only the automated supplier senders, and statements / collection
//    notices are explicitly excluded so they never become junk invoices.
//
// AUTH (no npm dependency — built-in crypto + fetch only)
// -------------------------------------------------------
// Uses a Google service account with domain-wide delegation, impersonating the mailbox.
// Required setup (one-time, by a Workspace super-admin) — see scripts/GMAIL_INGEST_SETUP.md.
//   env (in .env.local):
//     GMAIL_INGEST_SA_PATH   path to the service-account JSON key (default: ./gmail-sa.json)
//     GMAIL_INGEST_SUBJECT   mailbox to read (default: sales@freshnfruityghd.com)
//     POSTMARK_WEBHOOK_SECRET  the token the webhook checks (already set)
//
// USAGE
//   node scripts/gmail-ingest.mjs              # sweep + ingest
//   node scripts/gmail-ingest.mjs --dry-run    # list what WOULD be ingested, change nothing
//   node scripts/gmail-ingest.mjs --since 7d   # widen the lookback window (default 3d)

import { readFileSync } from 'fs'
import { createSign } from 'crypto'

// ---- config -------------------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SINCE = (() => {
  const i = args.indexOf('--since')
  return i >= 0 && args[i + 1] ? args[i + 1] : '3d'
})()

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

const SA_PATH = env.GMAIL_INGEST_SA_PATH || './gmail-sa.json'
const SUBJECT = env.GMAIL_INGEST_SUBJECT || 'sales@freshnfruityghd.com'
const WEBHOOK_SECRET = env.POSTMARK_WEBHOOK_SECRET
const WEBHOOK_URL = (env.GMAIL_INGEST_WEBHOOK || 'http://localhost:3100/api/delivery-note') + `?token=${encodeURIComponent(WEBHOOK_SECRET || '')}`
const LABEL_NAME = 'FreshIngested'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

// Only the automated supplier senders that send delivery notes / invoices.
// Statements & collection notices (e.g. Kath@jrholland) are NOT delivery docs — excluded.
const QUERY = [
  'has:attachment',
  `-label:${LABEL_NAME}`,
  `newer_than:${SINCE}`,
  '(from:totalproduce.com OR from:jrholland.co.uk OR from:thomasbaty.co.uk OR from:themilkcompany.co.uk)',
  '-from:Kath@jrholland.co.uk',
  '-subject:statement',
  '-subject:"collection notice"',
].join(' ')

if (!WEBHOOK_SECRET) { console.error('✗ POSTMARK_WEBHOOK_SECRET missing from .env.local'); process.exit(1) }

// ---- google service-account auth (DWD) ----------------------------------------------
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function getAccessToken() {
  let sa
  try { sa = JSON.parse(readFileSync(SA_PATH, 'utf8')) }
  catch { console.error(`✗ Service-account key not found at ${SA_PATH}. See scripts/GMAIL_INGEST_SETUP.md`); process.exit(1) }

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: GMAIL_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    sub: SUBJECT,                 // domain-wide delegation: act as the mailbox
    iat: now,
    exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const sig = b64url(signer.sign(sa.private_key))
  const assertion = `${header}.${claim}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const json = await res.json()
  if (!json.access_token) {
    console.error('✗ Token exchange failed:', JSON.stringify(json))
    console.error('  → Usually means domain-wide delegation is not authorised for this scope. See setup doc.')
    process.exit(1)
  }
  return json.access_token
}

// ---- gmail REST helpers -------------------------------------------------------------
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
let TOKEN

async function gmail(path, opts = {}) {
  const res = await fetch(`${GMAIL}${path}`, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`Gmail ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function ensureLabelId() {
  const { labels } = await gmail('/labels')
  const found = labels.find(l => l.name === LABEL_NAME)
  if (found) return found.id
  if (DRY_RUN) return null
  const created = await gmail('/labels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: LABEL_NAME, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  })
  return created.id
}

const header = (msg, name) => (msg.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

// Walk the MIME tree collecting every PDF part (filename + attachmentId).
function collectPdfParts(payload, out = []) {
  const parts = payload?.parts || []
  for (const p of parts) {
    const isPdf = p.mimeType === 'application/pdf' || (p.filename || '').toLowerCase().endsWith('.pdf')
    if (isPdf && p.body?.attachmentId) out.push({ filename: p.filename || 'attachment.pdf', attachmentId: p.body.attachmentId })
    if (p.parts) collectPdfParts(p, out)
  }
  return out
}

// ---- main ---------------------------------------------------------------------------
const summary = { scanned: 0, ingested: 0, skipped: 0, failed: 0, pdfs: 0 }

TOKEN = await getAccessToken()
const labelId = await ensureLabelId()
console.log(`Mailbox: ${SUBJECT}  |  query: ${QUERY}${DRY_RUN ? '  |  DRY-RUN' : ''}`)

const list = await gmail(`/messages?q=${encodeURIComponent(QUERY)}&maxResults=100`)
const ids = (list.messages || []).map(m => m.id)
console.log(`Found ${ids.length} candidate message(s).`)

for (const id of ids) {
  summary.scanned++
  try {
    const msg = await gmail(`/messages/${id}?format=full`)
    const from = header(msg, 'From')
    const subject = header(msg, 'Subject')
    const messageId = header(msg, 'Message-ID') || id
    const pdfParts = collectPdfParts(msg.payload)

    if (pdfParts.length === 0) { console.log(`  – ${subject} — no PDF part, skip`); summary.skipped++; continue }

    const Attachments = []
    for (const part of pdfParts) {
      const att = await gmail(`/messages/${id}/attachments/${part.attachmentId}`)
      // Gmail returns base64url; the webhook does Buffer.from(Content,'base64') → normalise.
      const Content = att.data.replace(/-/g, '+').replace(/_/g, '/')
      Attachments.push({ Name: part.filename, Content, ContentType: 'application/pdf', ContentLength: att.size || 0 })
      summary.pdfs++
    }

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

    // Stamp processed so we never re-ingest it.
    if (labelId) {
      await gmail(`/messages/${id}/modify`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ addLabelIds: [labelId] }),
      })
    }
    console.log(`  ✓ ingested "${subject}" (webhook processed=${out.processed})`)
    summary.ingested++
  } catch (err) {
    console.error(`  ✗ ${id}: ${err.message}`)
    summary.failed++
  }
}

console.log(`\nDone. scanned=${summary.scanned} ingested=${summary.ingested} skipped=${summary.skipped} failed=${summary.failed} pdfs=${summary.pdfs}`)
process.exit(summary.failed > 0 ? 1 : 0)
