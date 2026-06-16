'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Customer-facing "Mark as paid". Irreversible for now, so it asks for a second
// tap to confirm before posting. Used both inline in the invoice table (variant
// "row") and full-width on the invoice detail page (variant "full").
export default function MarkPaidButton({
  invoiceId,
  variant = 'full',
}: {
  invoiceId: string
  variant?: 'row' | 'full'
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function pay(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/portal/invoices/${invoiceId}/pay`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not mark as paid')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setConfirming(false)
      setSaving(false)
    }
  }

  if (variant === 'row') {
    // Plain text action (no pill/circle) so it reads like the status column.
    return (
      <button
        onClick={pay}
        disabled={saving}
        className={`text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50 ${
          confirming ? 'text-amber-400' : 'text-brand-accent hover:underline'
        }`}
      >
        {saving ? 'Saving…' : confirming ? 'Confirm?' : 'Pay'}
      </button>
    )
  }

  const label = saving ? 'Saving…' : confirming ? 'Tap to confirm' : 'Mark as paid'

  return (
    <div>
      <button
        onClick={pay}
        disabled={saving}
        className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
          confirming ? 'bg-green-600 text-white' : 'btn-primary'
        }`}
      >
        {label}
      </button>
      {confirming && !saving && (
        <p className="text-[var(--text-muted)] text-xs text-center mt-2">
          This can&apos;t be undone — tap again to confirm payment.
        </p>
      )}
      {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
    </div>
  )
}
