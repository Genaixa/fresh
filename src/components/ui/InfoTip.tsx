'use client'

import { useState, useRef, useEffect } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-4 h-4 rounded-full bg-white/10 text-[var(--text-muted)] text-[10px]
                   font-bold flex items-center justify-center leading-none
                   hover:bg-white/20 transition-colors flex-shrink-0"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span className="absolute left-0 top-6 z-50 w-60 bg-[var(--bg-card)]
                         border border-white/15 rounded-xl p-3 text-xs
                         text-[var(--text-muted)] shadow-xl leading-relaxed">
          {text}
        </span>
      )}
    </span>
  )
}
