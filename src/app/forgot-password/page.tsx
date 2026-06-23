'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPassword } from './actions'

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const sent = searchParams.get('sent') === '1'
  const hasError = searchParams.get('error') === '1'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🍋</div>
          <h1 className="text-2xl font-bold text-brand-accent">Reset Password</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Fresh & Fruity</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="rounded-xl bg-green-500/15 border border-green-500/30 px-4 py-4 text-sm text-green-400">
              Check your email — a reset link has been sent.
            </div>
            <Link href="/login" className="block text-sm text-brand-accent hover:underline mt-4">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {hasError && (
              <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400 text-center">
                Something went wrong. Please try again.
              </div>
            )}

            <p className="text-[var(--text-muted)] text-sm text-center mb-6">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                             px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                             focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                formAction={resetPassword}
                className="btn-primary w-full mt-2 text-base"
              >
                Send Reset Link
              </button>
            </form>

            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-brand-accent hover:underline">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordContent /></Suspense>
}
