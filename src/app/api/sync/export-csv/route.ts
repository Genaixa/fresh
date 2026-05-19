import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEposCsv } from '@/lib/epos-sync'
import type { Product } from '@/types'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const csv = generateEposCsv((products ?? []) as Product[])

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="fresh-fruity-prices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
