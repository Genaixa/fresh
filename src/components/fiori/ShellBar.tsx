import Link from 'next/link'

// Fiori "Belize" shell bar: dark blue-grey, app title, breadcrumb, search + notif + avatar.
export function ShellBar({ title }: { title: string }) {
  return (
    <header className="fiori-shellbar flex items-center gap-3 px-3">
      <Link href="/cfo" aria-label="Back to CFO" className="text-white/90 hover:text-white"
        style={{ fontSize: 20, lineHeight: 1 }}>‹</Link>
      <span className="text-white/70" style={{ fontSize: 13 }}>🍋 Fresh &amp; Fruity</span>
      <span className="text-white/30">|</span>
      <span className="font-semibold" style={{ fontSize: 14 }}>{title}</span>

      <div className="ml-auto flex items-center gap-3 text-white/85">
        <span aria-hidden style={{ fontSize: 14 }}>🔍</span>
        <span className="relative" aria-hidden style={{ fontSize: 14 }}>
          🔔
          <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#bb0000' }} />
        </span>
        <span className="grid place-items-center" aria-hidden
          style={{ width: 26, height: 26, borderRadius: '50%', background: '#0a6ed1', fontSize: 11, fontWeight: 600 }}>DG</span>
      </div>
    </header>
  )
}
