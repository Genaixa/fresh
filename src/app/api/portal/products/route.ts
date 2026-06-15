import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Customer-facing product search. Returns ONLY display fields — never cost,
// wholesale price, margins or any commercial data. The portal must never leak
// what David pays or charges.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, is_active')
    .eq('is_active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
