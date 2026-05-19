import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const form = await request.formData()
  const product_id = form.get('product_id') as string
  const quantity = parseFloat(form.get('quantity') as string)
  const unit_cost = parseInt(form.get('unit_cost') as string, 10)
  const reason = form.get('reason') as string

  if (!product_id || !quantity || !reason) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await supabase.from('waste_log').insert({
    product_id,
    quantity,
    unit_cost,
    reason,
    logged_by: user.id,
  })

  return NextResponse.redirect(new URL('/waste', request.url))
}
