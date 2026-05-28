'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewCustomerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    payment_terms: '30',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/wholesale/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          payment_terms: parseInt(form.payment_terms) || 30,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      router.push(`/wholesale/customers/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/wholesale/customers" className="text-[var(--text-muted)]">←</Link>
        <h1 className="text-xl font-bold">New Customer</h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card space-y-4">
          <div>
            <label className="label">Business name *</label>
            <input className="input" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="e.g. Moisdos" />
          </div>
          <div>
            <label className="label">Contact name</label>
            <input className="input" value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address}
              onChange={e => set('address', e.target.value)} />
          </div>
          <div>
            <label className="label">Payment terms (days)</label>
            <select className="input" value={form.payment_terms}
              onChange={e => set('payment_terms', e.target.value)}>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-4 text-lg">
          {saving ? 'Saving…' : 'Add Customer'}
        </button>
      </form>
    </div>
  )
}
