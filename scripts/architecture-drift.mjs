#!/usr/bin/env node
// Architecture drift check for Fresh & Fruity.
//
// Derives the CURRENT structural inventory straight from source + DB + crontab —
// page/api routes, lib modules, golems, DB tables/views/functions, fresh cron
// lines — and diffs it against a committed baseline. Anything new or removed
// means the hand-written architecture memory (reference_fresh_architecture) may
// be stale, so it Telegram-pings on the same channel the golems use.
//
// The factual half of the architecture map regenerates from reality; the drift
// check shouts when reality diverges from what's written down.
//
//   node scripts/architecture-drift.mjs            # check; alert on drift
//   node scripts/architecture-drift.mjs --update   # bless current state as the new baseline
//
// Wired at 10:00 (sibling of the data-golem). Kept as a standalone script — not
// inside the Next golem handler — because it needs fs + crontab + psql access
// that doesn't belong in a request handler.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(APP, 'scripts', 'architecture-baseline.json')

function walk(dir, match) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, match))
    else if (match(p)) out.push(p)
  }
  return out
}

function psql(sql) {
  try {
    return execFileSync(
      'psql',
      ['-h', '127.0.0.1', '-p', '54332', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
      { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' },
    ).split('\n').map(s => s.trim()).filter(Boolean).sort()
  } catch {
    return []
  }
}

function cronLines() {
  try {
    return execFileSync('crontab', ['-l'], { encoding: 'utf8' })
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && /fresh|3100|\/api\//.test(l))
      .sort()
  } catch {
    return []
  }
}

function deriveInventory() {
  const appDir = join(APP, 'src', 'app')
  const apiDir = join(appDir, 'api')
  const libDir = join(APP, 'src', 'lib')

  const pageRoutes = walk(appDir, p => p.endsWith('page.tsx'))
    .map(p => { const r = relative(appDir, dirname(p)).replace(/\\/g, '/'); return r ? '/' + r : '/' })
    .sort()
  const apiRoutes = walk(apiDir, p => p.endsWith('route.ts'))
    .map(p => '/api/' + relative(apiDir, dirname(p)).replace(/\\/g, '/'))
    .sort()
  const libModules = walk(libDir, p => p.endsWith('.ts'))
    .map(p => relative(libDir, p).replace(/\\/g, '/'))
    .sort()
  const golems = walk(join(APP, 'src'), p => /\.tsx?$/.test(p) && /golem/i.test(p))
    .map(p => relative(join(APP, 'src'), p).replace(/\\/g, '/'))
    .sort()

  return {
    pageRoutes,
    apiRoutes,
    libModules,
    golems,
    dbTables: psql("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"),
    dbViews: psql("select table_name from information_schema.views where table_schema='public'"),
    dbFunctions: psql("select routine_name from information_schema.routines where routine_schema='public'"),
    cron: cronLines(),
  }
}

function readEnv(key) {
  try {
    const line = readFileSync(join(APP, '.env'), 'utf8').split('\n').find(l => l.startsWith(key + '='))
    if (!line) return null
    let v = line.slice(key.length + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return v || null
  } catch {
    return null
  }
}

async function telegram(message) {
  if (process.argv.includes('--dry')) return  // print only, no send (testing / first run)
  const token = readEnv('TELEGRAM_BOT_TOKEN')
  const chat = readEnv('TELEGRAM_CHAT_ID')
  if (!token || !chat || typeof fetch !== 'function') return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: message, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('[drift] telegram failed:', err.message)
  }
}

const inv = deriveInventory()

if (process.argv.includes('--update') || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify(inv, null, 2) + '\n')
  console.log(existsSync(BASELINE) && process.argv.includes('--update') ? 'baseline re-blessed' : 'baseline created')
  process.exit(0)
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
const drift = []
for (const key of Object.keys(inv)) {
  const cur = new Set(inv[key])
  const old = new Set(base[key] || [])
  const added = inv[key].filter(x => !old.has(x))
  const removed = (base[key] || []).filter(x => !cur.has(x))
  if (added.length || removed.length) drift.push({ key, added, removed })
}

if (drift.length === 0) {
  console.log('no drift')
  process.exit(0)
}

let msg = '🗺️ <b>Architecture drift — map may be stale</b>'
for (const d of drift) {
  msg += `\n\n<b>${d.key}</b>`
  for (const a of d.added) msg += `\n  + ${a}`
  for (const r of d.removed) msg += `\n  − ${r}`
}
msg += '\n\nUpdate the reference_fresh_architecture memory, then re-run with --update to re-bless.'

console.log(msg.replace(/<[^>]+>/g, ''))
await telegram(msg)
process.exit(0)
