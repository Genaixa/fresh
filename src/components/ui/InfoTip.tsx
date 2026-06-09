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
    <span ref={ref} style={{ position: 'relative', display: 'inline' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'inline', padding: 0, margin: 0, lineHeight: 1 }}
        className="text-white/25 hover:text-white/60 transition-colors ml-0.5 cursor-pointer"
        aria-label="More info"
      >
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="currentColor"
          style={{ display: 'inline', verticalAlign: '-1px' }}
        >
          <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1"/>
          <text x="5" y="7.5" textAnchor="middle" fontSize="6" fontWeight="600">i</text>
        </svg>
      </button>
      {open && (
        <span style={{ position: 'absolute', left: 0, top: '1.25rem', zIndex: 50 }}
              className="w-56 bg-[var(--bg-card)] border border-white/15 rounded-xl p-3
                         text-xs text-[var(--text-muted)] shadow-2xl leading-relaxed">
          {text}
        </span>
      )}
    </span>
  )
}
