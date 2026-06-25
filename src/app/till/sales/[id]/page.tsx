import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/pricing-engine'
import { ReceiptPrintButton } from './ReceiptPrintButton'

export const dynamic = 'force-dynamic'

type Item = { product_name: string; quantity: number; unit: string; unit_price_pence: number; line_total_pence: number }
type Sale = {
  id: string
  created_at: string
  total_pence: number
  payment_method: string
  cash_tendered_pence: number | null
  change_pence: number | null
  status: string
  items: Item[]
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('till_transactions')
    .select('id, created_at, total_pence, payment_method, cash_tendered_pence, change_pence, status, ' +
      'items:till_transaction_items(product_name, quantity, unit, unit_price_pence, line_total_pence)')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const sale = data as unknown as Sale

  const when = new Date(sale.created_at).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="dark min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .receipt, .receipt * { visibility: visible !important; }
        .receipt { position: absolute; inset: 0; margin: 0 auto; color:#000; background:#fff; box-shadow:none; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 no-print">
        <span className="font-bold text-brand-accent">Receipt</span>
        <Link href="/till/sales" className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl border border-white/10 active:bg-white/5">← Sales</Link>
      </div>

      <div className="max-w-sm mx-auto p-4 space-y-3">
        <div className="receipt card p-5 font-mono text-sm">
          <div className="text-center mb-3">
            <p className="font-bold text-base">Fresh &amp; Fruity</p>
            <p className="text-xs opacity-70">Bensham, Gateshead</p>
          </div>
          <p className="text-xs opacity-70 text-center mb-3">{when}</p>
          {sale.status === 'voided' && (
            <p className="text-center font-bold mb-2">*** VOIDED ***</p>
          )}

          <div className="border-t border-dashed border-current/30 pt-2 space-y-1">
            {sale.items.map((it, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span>{it.product_name}</span>
                  <span>{formatPrice(it.line_total_pence)}</span>
                </div>
                <div className="text-xs opacity-60">
                  {it.unit === 'kg'
                    ? `${Number(it.quantity).toFixed(3)} kg @ ${formatPrice(it.unit_price_pence)}/kg`
                    : `${it.quantity} @ ${formatPrice(it.unit_price_pence)}`}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-current/30 mt-2 pt-2 space-y-1">
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span><span>{formatPrice(sale.total_pence)}</span>
            </div>
            <div className="flex justify-between text-xs opacity-70">
              <span>Paid by</span><span>{sale.payment_method}</span>
            </div>
            {sale.payment_method === 'cash' && sale.cash_tendered_pence != null && (
              <>
                <div className="flex justify-between text-xs opacity-70"><span>Tendered</span><span>{formatPrice(sale.cash_tendered_pence)}</span></div>
                <div className="flex justify-between text-xs opacity-70"><span>Change</span><span>{formatPrice(sale.change_pence ?? 0)}</span></div>
              </>
            )}
          </div>

          <p className="text-center text-xs opacity-70 mt-4">Thank you!</p>
        </div>

        <ReceiptPrintButton />
      </div>
    </div>
  )
}
