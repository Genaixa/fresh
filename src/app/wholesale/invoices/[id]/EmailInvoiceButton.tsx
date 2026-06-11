'use client'
import { useState } from 'react'

export function EmailInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function send() {
    setState('sending'); setMsg('')
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setState('sent'); setMsg(`Sent to ${data.to}`)
    } catch (e: any) {
      setState('error'); setMsg(e.message)
    }
  }

  return (
    <div className="mb-4">
      <button onClick={send} disabled={state === 'sending'}
        className="card block w-full text-center text-brand-accent text-sm py-3 font-medium disabled:opacity-50">
        {state === 'sending' ? 'Sending…' : state === 'sent' ? '✓ Emailed' : '✉ Email invoice'}
      </button>
      {msg && <p className={`text-xs mt-1 text-center ${state === 'error' ? 'text-status-red' : 'text-[var(--text-muted)]'}`}>{msg}</p>}
    </div>
  )
}
