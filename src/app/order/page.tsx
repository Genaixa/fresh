import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/ui/NavBar'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OrderIndexPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('wholesale_customers')
    .select('id, name, is_internal')
    .eq('is_active', true)
    .order('is_internal', { ascending: false })
    .order('name')

  // Open draft orders today
  const today = new Date().toISOString().split('T')[0]
  const { data: drafts } = await supabase
    .from('wholesale_orders')
    .select('customer_id')
    .eq('status', 'draft')
    .eq('order_date', today)

  const hasDraft = new Set((drafts ?? []).map(d => d.customer_id))

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-24 bg-white min-h-screen">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Place order</h1>
        <p className="text-xs text-gray-500">Who are you ordering for?</p>
      </div>

      <div className="space-y-2">
        {(customers ?? []).map(c => (
          <Link
            key={c.id}
            href={`/order/${c.id}`}
            className={`flex items-center justify-between rounded-xl border px-4 py-3.5 active:opacity-70 transition-opacity ${
              c.is_internal
                ? 'bg-[#0F1A0F] border-green-800 text-white'
                : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{c.is_internal ? '🏪' : '🏢'}</span>
              <div>
                <p className={`font-semibold text-sm ${c.is_internal ? 'text-white' : 'text-gray-900'}`}>
                  {c.name}
                </p>
                {c.is_internal && (
                  <p className="text-[10px] text-green-400">The shop</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasDraft.has(c.id) && (
                <span className="text-[9px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                  draft
                </span>
              )}
              <span className={`text-lg ${c.is_internal ? 'text-green-400' : 'text-gray-400'}`}>›</span>
            </div>
          </Link>
        ))}
      </div>

      <NavBar />
    </div>
  )
}
