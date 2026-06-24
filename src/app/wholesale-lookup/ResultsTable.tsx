'use client'

import { Fragment, useState } from 'react'
import { formatPrice, formatMargin } from '@/lib/pricing-engine'

export interface TradeRow {
  name:         string
  unit:         string
  boxCost:      number | null   // pence — latest matched invoice box cost
  trade:        number          // pence — suggested wholesale box price
  tradeMargin:  number | null   // fraction, vs box cost
  retail:       number          // pence — shop price per each/kg
  retailMargin: number | null   // fraction, vs stored per-unit cost
  retailApprox: boolean         // per-unit cost unreliable (count-sold) → flag
  lastSeen:     string | null   // ISO date of the box cost used
}

/**
 * Wholesale Quote results. Six logical columns; on narrow screens the two
 * percentage columns (Trade% / Retail%) drop out and the margins are revealed
 * by tapping a row instead (touch has no hover). On sm+ everything shows inline.
 */
export default function ResultsTable({ rows }: { rows: TradeRow[] }) {
  const [openRow, setOpenRow] = useState<string | null>(null)

  const retailPct = (r: TradeRow) =>
    r.retailMargin != null ? `${formatMargin(r.retailMargin)}${r.retailApprox ? ' ⚠' : ''}` : '—'
  const tradePct = (r: TradeRow) =>
    r.tradeMargin != null ? formatMargin(r.tradeMargin) : '—'

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--text-muted)] text-xs">
            <th className="text-left  px-3 py-2 font-medium">Variety</th>
            <th className="text-right px-3 py-2 font-medium">Box</th>
            <th className="text-right px-3 py-2 font-medium">Trade</th>
            <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Trade%</th>
            <th className="text-right px-3 py-2 font-medium">Retail</th>
            <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Retail%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = openRow === r.name
            return (
              <Fragment key={r.name}>
                <tr
                  onClick={() => setOpenRow(isOpen ? null : r.name)}
                  className="border-t border-[var(--border)] cursor-pointer sm:cursor-default"
                >
                  <td className="text-left  px-3 py-3">{r.name}</td>
                  <td className="text-right px-3 py-3 text-[var(--text-muted)]">
                    {r.boxCost != null ? formatPrice(r.boxCost) : '—'}
                  </td>
                  <td className="text-right px-3 py-3 font-semibold text-brand-accent">
                    {formatPrice(r.trade)}
                  </td>
                  <td className="text-right px-3 py-3 hidden sm:table-cell text-[var(--text-muted)]">
                    {tradePct(r)}
                  </td>
                  <td className="text-right px-3 py-3">
                    {formatPrice(r.retail)}
                    {r.unit === 'kg' ? <span className="text-[var(--text-muted)]">/kg</span> : null}
                  </td>
                  <td className="text-right px-3 py-3 hidden sm:table-cell text-[var(--text-muted)]">
                    {retailPct(r)}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="sm:hidden bg-black/10">
                    <td colSpan={4} className="px-3 pb-3 pt-0 text-xs text-[var(--text-muted)]">
                      Trade margin <b className="text-[var(--text)]">{tradePct(r)}</b>
                      {'  ·  '}
                      Retail margin <b className="text-[var(--text)]">{retailPct(r)}</b>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <p className="text-[11px] leading-snug text-[var(--text-muted)] px-3 py-2 border-t border-[var(--border)]">
        Box &amp; Trade are per box; Retail is per each/kg. ⚠ retail margin uses a
        per-each cost that&apos;s unreliable until box-counts are cleaned (/kg items
        are accurate). Tap a row for margins on mobile.
      </p>
    </div>
  )
}
