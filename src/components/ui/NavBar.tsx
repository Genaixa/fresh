'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pages that are full-screen experiences with no app chrome
const HIDDEN_ROUTES = ['/login', '/till', '/forgot-password', '/reset-password', '/portal']

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',     icon: '🏠' },
  { href: '/till',      label: 'Till',     icon: '🛍️' },
  { href: '/market-run', label: 'Market',   icon: '🛒' },
  { href: '/dispatch',  label: 'Dispatch', icon: '🚐' },
  { href: '/cfo',       label: 'CFO',      icon: '🧠' },
]

export function NavBar() {
  const pathname = usePathname()
  if (HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null
  return (
    <nav className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto h-16 z-50
                    bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg
                    flex justify-around items-center">
      {NAV_ITEMS.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px]
                        text-xs gap-0.5 transition-colors
                        ${active ? 'text-brand-accent' : 'text-[var(--text-muted)]'}`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
