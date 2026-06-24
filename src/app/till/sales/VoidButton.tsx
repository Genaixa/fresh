'use client'

import { useState, useTransition } from 'react'
import { voidTransaction } from '../actions'

export function VoidButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()

  if (confirm) {
    return (
      <span className="flex items-center gap-1">
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await voidTransaction(id); setConfirm(false) })}
          className="text-[11px] px-2 py-1 rounded-lg bg-status-red/20 text-status-red font-semibold active:bg-status-red/30 disabled:opacity-40"
        >
          {pending ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={pending}
          className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-[var(--text-muted)]"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-[11px] px-2 py-1 rounded-lg border border-white/15 text-[var(--text-muted)] active:bg-white/10"
    >
      Void
    </button>
  )
}
