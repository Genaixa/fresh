'use client'

import { useState, useEffect } from 'react'
import { upsertProduct } from './actions'
import { InfoTip } from '@/components/ui/InfoTip'

type Props = {
  id?: string
  defaultValues: {
    name: string
    category: string
    unit: string
    retail_price: string
    wholesale_price: string
    purchase_cost: string
    case_size: number
    price_multiplier: number
    market_ceiling: string
    margin_floor: number
    epos_now_id: string
    default_supplier_id: string
  }
  suppliers: { id: string; name: string }[]
  isNew: boolean
  deactivateButton?: React.ReactNode
}

const UNITS = ['each', 'kg', 'box', 'punnet', 'bunch', 'bag']
const UNIT_CASE_LABELS: Record<string, string> = {
  each:   'Units per delivery case',
  box:    'Boxes per delivery case',
  punnet: 'Punnets per delivery tray',
  bunch:  'Bunches per delivery box',
  bag:    'Bags per delivery box',
}

export function ProductForm({ id, defaultValues: d, suppliers, isNew, deactivateButton }: Props) {
  const [unit, setUnit]             = useState(d.unit)
  const [retail, setRetail]         = useState(d.retail_price)
  const [cost, setCost]             = useState(d.purchase_cost)
  const [floor, setFloor]           = useState(d.margin_floor.toString())
  const [multiplier, setMultiplier] = useState(d.price_multiplier.toString())

  useEffect(() => {
    const r = parseFloat(retail)
    const c = parseFloat(cost)
    if (r > 0 && c > 0) setMultiplier((r / c).toFixed(2))
  }, [retail, cost])

  const r          = parseFloat(retail) || 0
  const c          = parseFloat(cost)   || 0
  const f          = parseFloat(floor)  || 0
  const margin     = r > 0 && c > 0 ? (r - c) / r : null
  const marginPct  = margin !== null ? Math.round(margin * 1000) / 10 : null
  const floorFrac  = f / 100
  const atLoss     = margin !== null && margin < 0
  const belowFloor = margin !== null && !atLoss && margin < floorFrac
  const healthy    = margin !== null && margin >= floorFrac
  const showCaseSize = unit !== 'kg'

  return (
    <form className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}

      <Field label="Product name">
        <input name="name" defaultValue={d.name} required className="input-field" placeholder="e.g. Lemon" />
      </Field>

      <Field label={<>Default supplier <InfoTip text="Who you buy this product from. Used to auto-match new invoices and track costs by supplier." /></>}>
        <select name="default_supplier_id" defaultValue={d.default_supplier_id} className="input-field">
          <option value="">— Unknown —</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select name="category" defaultValue={d.category} className="input-field">
            <option value="fruit">Fruit</option>
            <option value="veg">Veg</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label={<>Unit <InfoTip text="How this product is sold — Each (individual), Kg (by weight), Punnet, Bag, etc." /></>}>
          <select name="unit" value={unit} onChange={e => setUnit(e.target.value)} className="input-field">
            {UNITS.map(u => (
              <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Retail price (£)">
          <input name="retail_price" type="number" min="0" step="0.01"
            value={retail} onChange={e => setRetail(e.target.value)} className="input-field" />
        </Field>
        <Field label={<>Wholesale price (£) <InfoTip text="Price you charge when selling in bulk to businesses like restaurants or other shops. Leave 0 if not applicable." /></>}>
          <input name="wholesale_price" type="number" min="0" step="0.01"
            defaultValue={d.wholesale_price} className="input-field" />
        </Field>
      </div>

      <Field label={<>Purchase cost (£) <InfoTip text="What you pay per individual unit sold to customers — NOT the whole box price. E.g. a box of 90 lychees costs £16, so enter £0.18 here." /></>}>
        <input name="purchase_cost" type="number" min="0" step="0.01"
          value={cost} onChange={e => setCost(e.target.value)} className="input-field" />
      </Field>

      {showCaseSize && (
        <Field label={<>{UNIT_CASE_LABELS[unit] ?? 'Units per delivery case'} <InfoTip text="How many individual retail units arrive in one delivery box or case. Used to calculate cost-per-unit automatically when you confirm invoices." /></>}>
          <input name="case_size" type="number" min="1" step="1"
            defaultValue={d.case_size} className="input-field" placeholder="e.g. 12" />
        </Field>
      )}
      {!showCaseSize && <input type="hidden" name="case_size" value="1" />}

      <div className="border-t border-white/10 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Pricing Engine</p>
        <div className="space-y-3">
          <Field label={<>Price multiplier <InfoTip text="Auto-calculated from retail ÷ cost. When costs change, the engine uses this to suggest a new retail price. You can override it." /></>}>
            <input name="price_multiplier" type="number" step="0.01" min="1"
              value={multiplier} onChange={e => setMultiplier(e.target.value)} className="input-field" />
          </Field>
          <Field label={<>Market ceiling (£) <InfoTip text="The absolute maximum you'd ever charge, even if costs spike. Pricing engine will never suggest above this. Leave blank for no limit." /></>}>
            <input name="market_ceiling" type="number" min="0" step="0.01"
              defaultValue={d.market_ceiling} className="input-field" placeholder="No ceiling" />
          </Field>
          <Field label={<>Margin floor (%) <InfoTip text="Your minimum acceptable profit percentage. If your margin drops below this, a price suggestion is automatically created for you to review." /></>}>
            <input name="margin_floor" type="number" step="1" min="0" max="100"
              value={floor} onChange={e => setFloor(e.target.value)} className="input-field" />
          </Field>

          {marginPct !== null && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between
              ${atLoss     ? 'bg-status-red/15 border border-status-red/40'
              : belowFloor ? 'bg-status-amber/10 border border-status-amber/30'
              :              'bg-status-green/10 border border-status-green/30'}`}>
              <span className={atLoss ? 'text-status-red' : belowFloor ? 'text-status-amber' : 'text-status-green'}>
                {atLoss     ? `Selling at a loss — margin ${marginPct}%`
                : belowFloor ? `Below floor — margin ${marginPct}% (floor ${f}%)`
                :              `Margin ${marginPct}%`}
              </span>
              {healthy    && <span className="text-status-green text-base">✓</span>}
              {belowFloor && <span className="text-status-amber text-base">⚠</span>}
              {atLoss     && <span className="text-status-red text-base">✗</span>}
            </div>
          )}
        </div>
      </div>

      <Field label={<>EPOS Now ID <InfoTip text="The product ID from your Epos Now till system. Used to sync prices automatically. Leave blank if not connected." /></>}>
        <input name="epos_now_id" defaultValue={d.epos_now_id}
          className="input-field" placeholder="Leave blank if not synced" />
      </Field>

      <button formAction={upsertProduct} className="btn-primary w-full mt-2">
        {isNew ? 'Create Product' : 'Save Changes'}
      </button>

      {deactivateButton}
    </form>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center text-sm font-medium mb-1.5 text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  )
}
