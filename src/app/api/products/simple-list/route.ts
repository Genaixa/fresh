import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, retail_price, purchase_cost, margin_floor, market_ceiling, weekly_units')
    .eq('is_active', true)
    .order('name')
  return NextResponse.json({ products: data ?? [] })
}
