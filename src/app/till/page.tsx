import { createClient } from '@/lib/supabase/server'
import { TillScreen } from './TillScreen'

export default async function TillPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, unit, retail_price, plu_code')
    .eq('is_active', true)
    .gt('retail_price', 0)
    .order('category')
    .order('name')

  return <TillScreen products={products ?? []} />
}
