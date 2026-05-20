// Test invoice upload script — authenticates via Supabase, then POSTs the PDF
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
// FormData is built into Node 18+

// Read credentials from .env.local
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY    = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, ANON_KEY)

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@freshandfruity.co.uk',
  password: 'testpass123',
})

if (error) { console.error('Auth error:', error.message); process.exit(1) }

const { access_token, refresh_token } = data.session
console.log('Signed in as:', data.user.email)

// Build cookie string in the format Supabase SSR expects
// SSR uses just the first octet of the hostname for local IPs
const hostname = new URL(SUPABASE_URL).hostname  // "127.0.0.1"
const projectRef = hostname.split('.')[0]         // "127"
const cookieName = `sb-${projectRef}-auth-token`
console.log('Cookie name:', cookieName)
const cookieValue = encodeURIComponent(JSON.stringify({
  access_token, refresh_token,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: data.session.expires_at,
  user: data.user,
}))

// Try chunked cookie format too (used by newer @supabase/ssr)
const cookieStr = `${cookieName}=${cookieValue}`

// Read the PDF
const pdfBuffer = readFileSync('/tmp/test-invoice.pdf')
const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
const form = new FormData()
form.append('pdf', blob, 'test-invoice.pdf')
form.append('invoice_date', '2026-05-08')

console.log('Uploading invoice...')
const res = await fetch('http://localhost:3100/api/invoices/upload', {
  method: 'POST',
  headers: { 'Cookie': cookieStr },
  body: form,
})

const body = await res.text()
console.log('Status:', res.status)
console.log('Response:', body.slice(0, 300))

if (res.ok) {
  const { invoice_id } = JSON.parse(body)
  console.log('\nInvoice created! Review at:')
  console.log(`http://72.62.210.21:3100/invoices/${invoice_id}/review`)
}
