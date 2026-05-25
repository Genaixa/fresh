'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── types ──────────────────────────────────────────────────────────────────────

export interface DeliveryItem {
  id: number
  invoice_id: number
  product_name: string
  product_code: string | null
  quantity: number | null
  unit: string | null
  unit_price_p: number | null
  total_price_p: number | null
  delivery_date: string | null
  ticket_number: string | null
}

export interface DeliveryInvoice {
  id: number
  supplier: string
  date: string | null
  invoice_number: string | null
  reference: string | null
  filename: string
}

// ── fruit / veg classification ─────────────────────────────────────────────────

const FRUIT_KW = [
  'apple','pear','banana','grape','orange','lemon','lime','mango','pineapple',
  'kiwi','melon','honeydew','cantaloupe','watermelon','strawberry','raspberry',
  'blueberry','blackberry','cherry','plum','peach','nectarine','apricot',
  'pomegranate','papaya','passion','coconut','lychee','clementine','satsuma',
  'tangerine','grapefruit','mandarin','fig','guava','persimmon','kaki','date',
  'dragonfruit','physalis','redcurrant','blackcurrant','gooseberry','cranberry',
  'quince','kumquat','pomelo','sharon','galia','ugli','plumcot','greengage',
  'damson','sloe','elderberry','mulberry','feijoa','rambutan','jackfruit',
  'starfruit','tamarind','nispero','nectarine',
]

const VEG_KW = [
  'carrot','potato','tomato','onion','garlic','broccoli','cauliflower',
  'cabbage','lettuce','spinach','pepper','courgette','aubergine','cucumber',
  'celery','leek','beetroot','parsnip','turnip','swede','radish','mushroom',
  'pea','bean','corn','sweetcorn','artichoke','asparagus','fennel','ginger',
  'celeriac','kohlrabi','chilli','chili','cress','herb','basil','mint',
  'parsley','coriander','dill','thyme','rosemary','watercress','rocket',
  'endive','chicory','radicchio','kale','chard','pakchoi','bokchoi','okra',
  'pumpkin','squash','butternut','marrow','shallot','avocado','sweetpotato',
  'yam','cassava','chinese','sprout','brussels','savoy','hispi','salad',
  'lambs','leaves','vine','cherry tomato','plum tomato','beef tomato',
  'tomatocherry','tomatoplum','tomatovine','tomatobeef',
]

type Category = 'veg' | 'fruit' | 'other'

function classify(name: string): Category {
  const n = name.toLowerCase().replace(/[^a-z]/g, '')
  for (const kw of FRUIT_KW) if (n.includes(kw.replace(/[^a-z]/g, ''))) return 'fruit'
  for (const kw of VEG_KW)   if (n.includes(kw.replace(/[^a-z]/g, ''))) return 'veg'
  return 'other'
}

function displayName(raw: string) {
  return raw.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
}

// ── sort ────────────────────────────────────────────────────────────────────────

type SortKey = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

function sortItems(items: DeliveryItem[], key: SortKey): DeliveryItem[] {
  return [...items].sort((a, b) => {
    if (key === 'name_asc')   return a.product_name.localeCompare(b.product_name)
    if (key === 'name_desc')  return b.product_name.localeCompare(a.product_name)
    if (key === 'price_asc')  return (a.unit_price_p ?? 0) - (b.unit_price_p ?? 0)
    if (key === 'price_desc') return (b.unit_price_p ?? 0) - (a.unit_price_p ?? 0)
    return 0
  })
}

function fmtPrice(p: number | null) {
  if (p == null) return '—'
  return `£${(p / 100).toFixed(2)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── SortBar ─────────────────────────────────────────────────────────────────────

function SortBar({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const btn = (k: SortKey, label: string) => (
    <button
      key={k}
      onClick={() => onChange(k)}
      className={`px-2 py-1 rounded text-xs transition-colors ${
        value === k
          ? 'bg-brand-accent text-white font-semibold'
          : 'text-[var(--text-muted)] active:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex gap-1 mb-2">
      {btn('name_asc',   'A→Z')}
      {btn('name_desc',  'Z→A')}
      {btn('price_asc',  '£↑')}
      {btn('price_desc', '£↓')}
    </div>
  )
}

// ── ItemRow ──────────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: DeliveryItem }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 gap-2">
      <p className="text-xs leading-tight flex-1 min-w-0 truncate">
        {displayName(item.product_name)}
      </p>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold">{fmtPrice(item.unit_price_p)}</p>
        {item.quantity != null && (
          <p className="text-[10px] text-[var(--text-muted)]">×{item.quantity}</p>
        )}
      </div>
    </div>
  )
}

// ── Column ───────────────────────────────────────────────────────────────────────

function Column({ title, items }: { title: string; items: DeliveryItem[] }) {
  const [sort, setSort] = useState<SortKey>('name_asc')
  const sorted = sortItems(items, sort)
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-sm">
          {title} <span className="text-[var(--text-muted)] font-normal text-xs">({items.length})</span>
        </h3>
      </div>
      <SortBar value={sort} onChange={setSort} />
      <div>
        {sorted.map(item => <ItemRow key={item.id} item={item} />)}
        {items.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] py-3">None</p>
        )}
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────────

export function DeliveryDetail({
  invoice,
  ticketKey,
  items,
}: {
  invoice: DeliveryInvoice
  ticketKey: string
  items: DeliveryItem[]
}) {
  const veg   = items.filter(i => classify(i.product_name) === 'veg')
  const fruit = items.filter(i => classify(i.product_name) === 'fruit')
  const other = items.filter(i => classify(i.product_name) === 'other')

  const [showOther, setShowOther] = useState(false)

  const deliveryDate = items[0]?.delivery_date ?? invoice.date
  const ticketNumber = items[0]?.ticket_number

  return (
    <>
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/invoices/archive/${invoice.id}`}
          className="text-brand-accent text-sm font-medium min-h-[40px] flex items-center"
        >
          ‹ {invoice.invoice_number ?? `Invoice #${invoice.id}`}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{fmtDate(deliveryDate)}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {invoice.supplier}
            {ticketNumber ? ` · Ticket ${ticketNumber}` : ''}
          </p>
        </div>
      </div>

      {/* PDF link */}
      <a
        href={`http://72.62.210.21:8000/invoices/${invoice.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
        className="card flex items-center justify-between mb-6 min-h-[48px]
                   active:scale-[0.99] transition-transform"
      >
        <span className="text-sm font-medium">{invoice.filename}</span>
        <span className="text-brand-accent text-sm ml-4">Download PDF ↗</span>
      </a>

      {/* no items */}
      {items.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-[var(--text-muted)] text-sm">No items found for this delivery.</p>
        </div>
      )}

      {/* two-column table */}
      {items.length > 0 && (
        <>
          <div className="flex gap-4 items-start">
            <Column title="Veg"   items={veg}   />
            <div className="w-px bg-white/10 self-stretch" />
            <Column title="Fruit" items={fruit} />
          </div>

          {other.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowOther(v => !v)}
                className="text-xs text-[var(--text-muted)] flex items-center gap-1 mb-2"
              >
                <span
                  style={{ display: 'inline-block', transform: showOther ? 'rotate(90deg)' : 'none' }}
                  className="transition-transform"
                >›</span>
                Other ({other.length})
              </button>
              {showOther && (
                <div className="card p-3 space-y-1">
                  {other.map(item => <ItemRow key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
