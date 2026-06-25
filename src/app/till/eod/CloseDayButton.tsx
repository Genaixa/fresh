'use client'

import { useState, useTransition } from 'react'
import { closeDay } from '../actions'

export function PrintXButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex-1 py-3 rounded-xl border border-white/15 text-sm text-[var(--text-muted)] active:bg-white/5"
    >
      Print X-read
    </button>
  )
}

export function CloseDayButton({ hasSales }: { hasSales: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={!hasSales}
        className="flex-1 py-3 rounded-xl bg-status-green/20 text-status-green font-bold text-sm active:bg-status-green/30 disabled:opacity-30"
      >
        Close Day (Z)
      </button>
    )
  }

  return (
    <div className="flex-1 space-y-1.5">
      <p className="text-[11px] text-status-amber text-center">Seal the period? This can&apos;t be undone.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await closeDay()
            if (!res.ok) { setError(res.error); setConfirm(false) }
            else setConfirm(false)
          })}
          className="flex-1 py-2.5 rounded-xl bg-status-green/25 text-status-green font-bold text-sm disabled:opacity-40"
        >
          {pending ? 'Closing…' : 'Confirm Z'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirm(false)}
          className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-[var(--text-muted)]"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[11px] text-status-red text-center">{error}</p>}
    </div>
  )
}
