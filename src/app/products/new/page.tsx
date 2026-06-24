import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '../ProductForm'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const newDefaults = {
    name:                '',
    category:            'fruit',
    unit:                'each',
    retail_price:        '0.00',
    wholesale_price:     '0.00',
    purchase_cost:       '0.00',
    case_size:           1,
    price_multiplier:    2.0,
    market_ceiling:      '',
    margin_floor:        20,
    epos_now_id:         '',
    plu_code:            '',
    default_supplier_id: '',
  }

  return (
    <div className="page pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-brand-accent min-h-[48px] min-w-[48px]
                                          flex items-center justify-center text-xl">
          ←
        </Link>
        <h1 className="text-xl font-bold">New Product</h1>
      </div>
      <ProductForm defaultValues={newDefaults} suppliers={suppliers ?? []} isNew />
    </div>
  )
}
