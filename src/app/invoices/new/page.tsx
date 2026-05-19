'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadInvoicePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-') // Convert to YYYY-MM-DD for input

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError(null)
    setProgress(10)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('pdf', file)

    try {
      setProgress(30)
      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      })
      setProgress(80)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setProgress(100)
      router.push(`/invoices/${data.invoice_id}/review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-brand-accent min-h-[48px] min-w-[48px] flex items-center justify-center text-xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Upload Invoice</h1>
      </div>

      {uploading ? (
        <div className="card text-center py-10">
          <p className="text-lg font-semibold mb-4">Scanning invoice...</p>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <div
              className="bg-brand-accent h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--text-muted)]">{progress}%</p>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            Claude AI is reading your invoice…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="card border-2 border-dashed border-brand-accent/40 flex flex-col
                       items-center justify-center py-12 cursor-pointer active:scale-[0.99]
                       transition-transform min-h-[160px]"
          >
            <span className="text-4xl mb-3">📄</span>
            {file ? (
              <p className="font-medium text-brand-accent">{file.name}</p>
            ) : (
              <>
                <p className="font-medium">Tap to choose PDF</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">or drop here</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Date and supplier */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              Invoice date
            </label>
            <input
              name="invoice_date"
              type="date"
              defaultValue={today}
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              Supplier (optional)
            </label>
            <input
              name="supplier_name"
              className="input-field"
              placeholder="e.g. Newcastle Fruit Market"
            />
          </div>

          {error && (
            <p className="text-status-red text-sm rounded-xl bg-status-red/10 px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!file}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Upload & Scan
          </button>
        </form>
      )}
    </div>
  )
}
