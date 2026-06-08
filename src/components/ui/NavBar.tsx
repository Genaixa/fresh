'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home',     icon: '🏠' },
  { href: '/till',      label: 'Till',     icon: '🛍️' },
  { href: '/market',    label: 'Market',   icon: '🛒' },
  { href: '/dispatch',  label: 'Dispatch', icon: '🚐' },
  { href: '/cfo',       label: 'CFO',      icon: '🧠' },
]

export function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-white/10
                    flex justify-around items-center h-16 z-50 max-w-lg mx-auto">
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
