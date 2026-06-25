// Offline-first till: a durable local queue of sales (IndexedDB).
//
// The till writes every completed sale here FIRST — before any network — so a
// sale survives a dropped connection, a crash, or a reload. A background
// flusher drains the queue to the server; because each sale carries a
// client_uuid (see migration 0106) the server records it exactly once, so it is
// always safe to retry a queued sale. Nothing is removed from the queue until
// the server confirms it stored it.
//
// Deliberately uses the native IndexedDB API (no dependency) to keep the till
// bundle lean and the supply chain small.

export interface PendingSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit: string
  unit_price_pence: number
  line_total_pence: number
}

export interface PendingSale {
  client_uuid: string          // primary key + server idempotency key
  queued_at: number            // epoch ms, for ordering / age
  total_pence: number
  payment_method: 'cash' | 'card'
  cash_tendered_pence: number | null
  change_pence: number | null
  items: PendingSaleItem[]
}

const DB_NAME = 'ff-till'
const STORE = 'pending-sales'
const VERSION = 1

/** RFC4122 v4 id. Prefers crypto.randomUUID (secure contexts) with a fallback. */
export function newClientUuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (c?.randomUUID) return c.randomUUID()
  // Fallback for non-secure contexts (e.g. plain-http LAN device).
  const b = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'client_uuid' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  }))
}

/** Durably store a sale. Resolves only once it's committed to disk. */
export async function enqueueSale(sale: PendingSale): Promise<void> {
  await tx<IDBValidKey>('readwrite', s => s.put(sale))
}

export async function allPending(): Promise<PendingSale[]> {
  const rows = await tx<PendingSale[]>('readonly', s => s.getAll())
  return (rows ?? []).sort((a, b) => a.queued_at - b.queued_at)
}

export async function removePending(clientUuid: string): Promise<void> {
  await tx<undefined>('readwrite', s => s.delete(clientUuid))
}

export async function countPending(): Promise<number> {
  return tx<number>('readonly', s => s.count())
}
