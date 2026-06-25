'use client'

import { useEffect } from 'react'

/**
 * Registers the offline app-shell service worker when the till is opened.
 * Production-only: in dev the SW would cache HMR assets and cause confusion.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
