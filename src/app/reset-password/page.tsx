'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { updatePassword } from './actions'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-5 h-5">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function ResetPasswordContent() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === '1'

  function handleSubmit(formData: FormData) {
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    updatePassword(formData)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🍋</div>
          <h1 className="text-2xl font-bold text-brand-accent">New Password</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Choose something memorable</p>
        </div>

        {hasError && (
          <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400 text-center">
            Something went wrong. Please request a new reset link.
          </div>
        )}

        {mismatch && (
          <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400 text-center">
            Passwords don&apos;t match.
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                           px-4 py-3 pr-12 text-base text-[var(--text)] min-h-[48px]
                           focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                           hover:text-[var(--text)] p-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                           px-4 py-3 pr-12 text-base text-[var(--text)] min-h-[48px]
                           focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                           hover:text-[var(--text)] p-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-6 text-base"
          >
            Set New Password
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordContent /></Suspense>
}
