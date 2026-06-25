// Fresh & Fruity till — offline app-shell service worker.
//
// Goal: the TILL PAGE keeps loading when the network drops, so the shop can
// always trade. It does NOT touch sales submission — those are POST/server
// actions which the till's IndexedDB queue already handles offline (a sale is
// stored locally and synced later, exactly once via client_uuid). The SW only
// makes GETs (the page shell + its static assets) available offline.
//
// Strategy:
//   • Navigations to /till*  → network-first, fall back to the cached shell.
//   • /_next/static + manifest → stale-while-revalidate.
//   • Everything else (other pages, cross-origin, all POSTs) → passthrough.
//
// The device must load the till online once to warm the cache (which is exactly
// how a parallel-run till is provisioned).

const CACHE = 'ff-till-v1'
const ASSET_RE = /\/_next\/static\//

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return                     // never intercept POST / server actions
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return      // only same-origin

  // The till page (and its sales view): network-first so online is always fresh,
  // cache fallback so it still renders offline.
  if (req.mode === 'navigate' && url.pathname.startsWith('/till')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put(req, fresh.clone())
        return fresh
      } catch {
        const cached = (await caches.match(req)) || (await caches.match('/till'))
        if (cached) return cached
        throw new Error('offline and no cached till shell')
      }
    })())
    return
  }

  // Static build assets + manifest: stale-while-revalidate.
  if (ASSET_RE.test(url.pathname) || url.pathname === '/manifest.json') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      const network = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res })
        .catch(() => null)
      return cached || (await network) || new Response('', { status: 504 })
    })())
  }
})
