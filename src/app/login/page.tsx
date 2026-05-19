import { login } from './actions'

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🍋</div>
          <h1 className="text-2xl font-bold text-brand-accent">Fresh & Fruity</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Bensham, Gateshead</p>
        </div>

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
              className="w-full rounded-xl border border-white/10 bg-[var(--bg-card)]
                         px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                         focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-white/10 bg-[var(--bg-card)]
                         px-4 py-3 text-base text-[var(--text)] min-h-[48px]
                         focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
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
