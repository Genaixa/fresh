// One-shot migration runner — reads .env.local, applies the SQL, then exits.
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Parse .env.local manually
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.log('Available keys:', Object.keys(env).join(', '))
  process.exit(1)
}

console.log('Connecting to:', url)

const supabase = createClient(url, key)

const sql = `
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS case_size integer NOT NULL DEFAULT 1;

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS units_per_case integer;
`

const { error } = await supabase.rpc('exec_sql', { query: sql }).catch(() => ({ error: 'rpc not available' }))

if (error) {
  // Fall back to direct REST query via pg meta if rpc not available
  console.log('RPC not available, trying pg-meta...')
  const res = await fetch(`${url.replace('/rest/v1','')}/pg/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('pg-meta failed:', res.status, body.slice(0, 200))
    process.exit(1)
  }
  console.log('Migration applied via pg-meta')
} else {
  console.log('Migration applied via RPC')
}
