'use client'

export function ReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print w-full py-3 rounded-xl bg-brand-accent/20 text-brand-accent font-bold text-sm active:bg-brand-accent/30"
    >
      Print receipt
    </button>
  )
}
