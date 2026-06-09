'use client'

import { useState, useRef, useEffect } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block leading-none ml-0.5 translate-y-[-1px]">
      {/* Touch target is larger than visual — padding trick */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-1 -m-1 text-white/25 hover:text-white/60 transition-colors"
        aria-label="More info"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1"/>
          <text x="5" y="7.5" textAnchor="middle" fontSize="6" fontWeight="600">i</text>
        </svg>
      </button>

      {open && (
        <span className="absolute left-0 top-5 z-50 w-56 bg-[var(--bg-card)]
                         border border-white/15 rounded-xl p-3 text-xs
                         text-[var(--text-muted)] shadow-2xl leading-relaxed
                         pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}
