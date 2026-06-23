'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from './actions'

function LoginContent() {
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'invalid_credentials'
  const wasReset = searchParams.get('reset') === '1'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🍋</div>
          <h1 className="text-2xl font-bold text-brand-accent">Fresh & Fruity</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Bensham, Gateshead</p>
        </div>

        {wasReset && (
          <div className="mb-4 rounded-xl bg-green-500/15 border border-green-500/30 px-4 py-3 text-sm text-green-400 text-center">
            Password updated. Sign in with your new password.
          </div>
        )}

        {hasError && (
          <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-400 text-center">
            Email or password incorrect. Please try again.
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Username or email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]
                         px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                         focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
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
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="w-5 h-5">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="w-5 h-5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <div className="text-right mt-2">
              <Link href="/forgot-password" className="text-sm text-brand-accent hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            formAction={login}
            className="btn-primary w-full mt-6 text-base"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>
}
