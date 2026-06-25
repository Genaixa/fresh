'use client'

import { useState, useTransition } from 'react'
import { addCashMovement } from '../actions'

type Kind = 'float_open' | 'pay_in' | 'pay_out'
const LABELS: Record<Kind, string> = {
  float_open: 'Add float',
  pay_in: 'Pay in',
  pay_out: 'Pay out',
}

export function CashControls() {
  const [open, setOpen] = useState<Kind | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const pence = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(pence) || pence <= 0) { setError('Enter an amount'); return }
    startTransition(async () => {
      const res = await addCashMovement(open!, pence, note)
      if (!res.ok) { setError(res.error ?? 'Failed'); return }
      setOpen(null); setAmount(''); setNote(''); setError(null)
    })
  }

  if (open) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold">{LABELS[open]}</p>
        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" min="0" step="0.01" autoFocus
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="input-field flex-1" />
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="note (optional)"
            className="input-field flex-[2]" />
        </div>
        {error && <p className="text-[11px] text-status-red">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={pending}
            className="flex-1 py-2.5 rounded-xl bg-status-green/20 text-status-green font-bold text-sm disabled:opacity-40">
            {pending ? '…' : 'Save'}
          </button>
          <button onClick={() => { setOpen(null); setError(null) }} disabled={pending}
            className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-[var(--text-muted)]">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {(['float_open', 'pay_in', 'pay_out'] as Kind[]).map(k => (
        <button key={k} onClick={() => setOpen(k)}
          className="flex-1 py-2.5 rounded-xl border border-white/15 text-xs text-[var(--text-muted)] active:bg-white/5">
          {LABELS[k]}
        </button>
      ))}
    </div>
  )
}
