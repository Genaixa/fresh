'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DuplicateInfo {
  type: 'identical' | 'different'
  existing_id: string
  supplier_name: string
  invoice_date: string
  changes?: { added: number; removed: number; repriced: number }
}

export default function UploadInvoicePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')

  async function doUpload(extraFields?: Record<string, string>) {
    if (!file) return

    setUploading(true)
    setError(null)
    setDuplicate(null)
    setProgress(10)

    const formData = new FormData()
    formData.set('pdf', file)
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) formData.set(k, v)
    }

    try {
      setProgress(30)
      const res = await fetch('/api/invoices/upload', { method: 'POST', body: formData })
      setProgress(80)
      const text = await res.text()

      if (res.status === 409) {
        const data = JSON.parse(text)
        setDuplicate({
          type:          data.duplicate,
          existing_id:   data.existing_id,
          supplier_name: data.supplier_name,
          invoice_date:  data.invoice_date,
          changes:       data.changes,
        })
        setUploading(false)
        setProgress(0)
        return
      }

      if (!res.ok) {
        let msg = 'Upload failed'
        try { msg = JSON.parse(text)?.error ?? msg } catch { /* html */ }
        if (res.status === 401 || res.redirected) { window.location.href = '/login'; return }
        throw new Error(msg)
      }

      const data = JSON.parse(text)
      setProgress(100)
      router.push(`/invoices/${data.invoice_id}/review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUploading(false)
      setProgress(0)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    doUpload()
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
          <p className="text-xs text-[var(--text-muted)] mt-4">AI is reading your invoice…</p>
        </div>
      ) : duplicate ? (
        <div className="space-y-4">
          <div className={`card border ${duplicate.type === 'identical'
            ? 'border-status-amber/40 bg-status-amber/5'
            : 'border-status-red/40 bg-status-red/5'}`}>
            <p className="font-semibold text-base mb-1">
              {duplicate.type === 'identical' ? '⚠ Invoice already uploaded' : '⚠ Similar invoice exists'}
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              {duplicate.supplier_name} · {new Date(duplicate.invoice_date).toLocaleDateString('en-GB')}
            </p>

            {duplicate.type === 'identical' ? (
              <p className="text-sm">
                This invoice is <strong>100% identical</strong> to one already in the system.
                You can replace it or go back.
              </p>
            ) : (
              <div className="text-sm space-y-1">
                <p>An invoice for the same date exists but the contents differ:</p>
                <ul className="mt-2 space-y-0.5 text-[var(--text-muted)]">
                  {(duplicate.changes?.added ?? 0) > 0 && (
                    <li>+ {duplicate.changes!.added} new line{duplicate.changes!.added > 1 ? 's' : ''}</li>
                  )}
                  {(duplicate.changes?.removed ?? 0) > 0 && (
                    <li>− {duplicate.changes!.removed} removed line{duplicate.changes!.removed > 1 ? 's' : ''}</li>
                  )}
                  {(duplicate.changes?.repriced ?? 0) > 0 && (
                    <li>~ {duplicate.changes!.repriced} price change{duplicate.changes!.repriced > 1 ? 's' : ''}</li>
                  )}
                </ul>
                <p className="mt-2">Replace the old invoice with this one?</p>
              </div>
            )}
          </div>

          <button
            onClick={() => doUpload({ force: duplicate.type, replace_id: duplicate.existing_id })}
            className="btn-primary w-full"
          >
            {duplicate.type === 'identical' ? 'Upload anyway' : 'Yes, replace old invoice'}
          </button>
          <button
            onClick={() => { setDuplicate(null); setFile(null) }}
            className="w-full py-3 rounded-xl border border-white/20 text-sm"
          >
            Cancel — go back
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
