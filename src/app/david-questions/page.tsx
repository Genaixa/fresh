import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Row = {
  id: string; question: string; category: string; status: string
  proposed_answer: string | null; evidence: string | null; answer: string | null
  times_surfaced: number
}

export default async function DavidQuestionsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('david_questions')
    .select('id, question, category, status, proposed_answer, evidence, answer, times_surfaced')
    .order('status')
    .order('category')
  const rows = (data ?? []) as Row[]

  const open       = rows.filter(r => r.status === 'open')
  const resolved   = rows.filter(r => r.status === 'auto_resolved')
  const answered   = rows.filter(r => r.status === 'answered')

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-brand-accent min-h-[48px] min-w-[48px]
                                            flex items-center justify-center text-xl">←</Link>
        <h1 className="text-xl font-bold">David questions</h1>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Anything data can answer is auto-resolved nightly so David is only asked genuine unknowns.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <Stat n={open.length}     label="Needs David"   tone="text-status-amber" />
        <Stat n={resolved.length} label="Auto-resolved" tone="text-status-green" />
        <Stat n={answered.length} label="Answered"      tone="text-[var(--text-muted)]" />
      </div>

      {open.length > 0 && (
        <Section title={`Needs David (${open.length})`}>
          {open.map(r => (
            <div key={r.id} className="py-2 border-b border-[var(--border)] last:border-0">
              <div className="flex justify-between gap-2 text-sm">
                <span>{r.question}</span>
                <span className="text-xs text-[var(--text-muted)] shrink-0">{r.category}</span>
              </div>
              {r.times_surfaced > 0 && (
                <p className="text-xs text-status-amber mt-0.5">came up {r.times_surfaced + 1}×</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {resolved.length > 0 && (
        <Section title={`Auto-resolved — confirm & apply (${resolved.length})`}>
          {resolved.map(r => (
            <div key={r.id} className="py-2 border-b border-[var(--border)] last:border-0">
              <div className="text-sm">{r.question}</div>
              <div className="text-sm text-status-green mt-0.5">→ {r.proposed_answer}</div>
              {r.evidence && <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.evidence}</p>}
            </div>
          ))}
        </Section>
      )}

      {answered.length > 0 && (
        <Section title={`Answered (${answered.length})`}>
          {answered.map(r => (
            <div key={r.id} className="py-2 border-b border-[var(--border)] last:border-0 text-sm">
              <span>{r.question}</span>
              {r.answer && <span className="text-[var(--text-muted)]"> — {r.answer}</span>}
            </div>
          ))}
        </Section>
      )}

      {rows.length === 0 && (
        <div className="card"><p className="text-sm text-[var(--text-muted)]">No questions logged.</p></div>
      )}
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="card text-center py-3">
      <p className={`text-2xl font-bold ${tone}`}>{n}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="section-title">{title}</p>
      <div className="card">{children}</div>
    </div>
  )
}
