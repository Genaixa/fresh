'use client'

import { useState, useTransition } from 'react'
import { closeDay } from '../actions'
import { formatPrice } from '@/lib/pricing-engine'

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

export function CloseDayButton({ hasSales, expectedCash }: { hasSales: boolean; expectedCash: number }) {
  const [confirm, setConfirm] = useState(false)
  const [counted, setCounted] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const countedPence = counted.trim() === '' ? null : Math.round(parseFloat(counted) * 100)
  const variance = countedPence == null || !Number.isFinite(countedPence) ? null : countedPence - expectedCash

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
    <div className="flex-1 space-y-2">
      <div>
        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
          Count the drawer (expected {formatPrice(expectedCash)})
        </label>
        <input
          type="number" inputMode="decimal" min="0" step="0.01" autoFocus
          value={counted} onChange={e => setCounted(e.target.value)} placeholder="counted cash £"
          className="input-field w-full" />
        {variance !== null && Number.isFinite(variance) && (
          <p className={`text-[11px] mt-1 ${variance === 0 ? 'text-status-green' : 'text-status-amber'}`}>
            {variance === 0 ? 'Balances ✓' : `${variance > 0 ? 'Over' : 'Short'} ${formatPrice(Math.abs(variance))}`}
          </p>
        )}
      </div>
      <p className="text-[11px] text-status-amber text-center">Seal the period? This can&apos;t be undone.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await closeDay(countedPence != null && Number.isFinite(countedPence) ? countedPence : null)
            if (!res.ok) { setError(res.error); setConfirm(false) }
            else { setConfirm(false); setCounted('') }
          })}
          className="flex-1 py-2.5 rounded-xl bg-status-green/25 text-status-green font-bold text-sm disabled:opacity-40"
        >
          {pending ? 'Closing…' : 'Confirm Z'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => { setConfirm(false); setError(null) }}
          className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-[var(--text-muted)]"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[11px] text-status-red text-center">{error}</p>}
    </div>
  )
}
