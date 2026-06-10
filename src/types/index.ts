export type ProductCategory = 'fruit' | 'veg' | 'other'
export type ProductUnit     = 'each' | 'kg' | 'box' | 'punnet' | 'bunch' | 'bag'
export type InvoiceStatus   = 'uploaded' | 'processing' | 'processed' | 'error'
export type PriceType       = 'retail' | 'wholesale' | 'purchase'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'auto_applied' | 'on_hold' | 'withheld'
export type PricingRule     = 'multiplier' | 'ceiling' | 'floor'
export type WasteReason     = 'spoiled' | 'damaged' | 'markdown' | 'other'
export type UserRole        = 'owner' | 'cashier' | 'wholesale_customer'

export interface UserProfile {
  id: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  market_order: number | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  category: ProductCategory
  unit: ProductUnit
  retail_price: number       // pence
  wholesale_price: number    // pence
  purchase_cost: number      // pence (per box/case)
  case_size: number          // retail units per box; default 1
  price_multiplier: number
  market_ceiling: number | null  // pence
  margin_floor: number           // e.g. 0.20
  epos_now_id: string | null
  default_supplier_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseInvoice {
  id: string
  supplier_id: string | null
  supplier_name: string
  invoice_date: string
  pdf_url: string | null
  total_amount: number | null  // pence
  status: InvoiceStatus
  created_by: string | null
  created_at: string
}

export interface PurchaseInvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  product_name_raw: string
  brand_raw: string | null
  quantity: number
  unit_cost: number             // pence (per box/case)
  total_cost: number            // pence
  unit_type: 'count' | 'weight' | null
  units_per_case: number | null // retail units per box (count-based)
  box_weight_kg: number | null  // kg per box (weight-based)
  original_quoted_price: number | null  // pence
  negotiated_price: number | null       // pence
  discount_amount: number               // pence (generated)
  is_matched: boolean
  created_at: string
}

export interface PriceSuggestion {
  id: string
  product_id: string
  invoice_id: string | null
  current_retail_price: number    // pence
  suggested_retail_price: number  // pence
  rule_applied: PricingRule
  margin_percentage: number | null
  margin_warning: boolean
  status: SuggestionStatus
  block_reason: string | null          // why a 'withheld' suggestion was held back
  plausibility_ceiling: number | null  // pence — the plausible max it exceeded
  applied_at: string | null
  applied_by: string | null
  created_at: string
  // joined
  product?: Product
}

export interface PriceHistoryEntry {
  id: string
  product_id: string
  price_type: PriceType
  old_price: number  // pence
  new_price: number  // pence
  reason: string | null
  changed_by: string | null
  created_at: string
}

export interface WasteEntry {
  id: string
  product_id: string
  quantity: number
  unit_cost: number   // pence
  total_cost: number  // pence
  reason: WasteReason
  notes: string | null
  logged_by: string | null
  created_at: string
  // joined
  product?: Product
}

export interface SalesData {
  id: string
  product_id: string | null
  product_name_raw: string | null
  quantity_sold: number
  revenue: number  // pence
  sale_date: string
  source: string
  imported_at: string
}

// Pricing engine result
export interface PricingResult {
  product_id: string
  purchase_cost: number
  raw_price: number          // cost × multiplier
  suggested_price: number    // after ceiling applied
  rule_applied: PricingRule
  margin_percentage: number
  margin_warning: boolean    // true if ceiling prevents margin_floor
}

// ────────────────────────────────────────────────────────────
// STAGE 2 — WHOLESALE INVOICING
// ────────────────────────────────────────────────────────────

export type OrderStatus          = 'draft' | 'confirmed' | 'dispatched' | 'cancelled'
export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type PaymentMethod        = 'bank_transfer' | 'cash' | 'card' | 'other'

export interface WholesaleCustomer {
  id:             string
  name:           string
  contact_name:   string | null
  email:          string | null
  phone:          string | null
  address:        string | null
  payment_terms:  number          // days
  is_active:      boolean
  portal_user_id: string | null
  created_at:     string
  updated_at:     string
}

export interface WholesaleOrder {
  id:            string
  customer_id:   string
  order_date:    string
  delivery_date: string | null
  status:        OrderStatus
  notes:         string | null
  created_by:    string | null
  created_at:    string
  updated_at:    string
  // joined
  customer?:     WholesaleCustomer
  items?:        WholesaleOrderItem[]
}

export interface WholesaleOrderItem {
  id:         string
  order_id:   string
  product_id: string
  quantity:   number
  unit_price: number   // pence — locked at time of order
  created_at: string
  // joined
  product?:   Product
}

export interface WholesaleInvoice {
  id:              string
  customer_id:     string
  order_id:        string | null
  invoice_number:  string
  invoice_date:    string
  due_date:        string
  subtotal:        number  // pence
  total_amount:    number  // pence
  amount_paid:     number  // pence
  payment_status:  InvoicePaymentStatus
  pdf_path:        string | null
  xero_invoice_id: string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
  // joined
  customer?:       WholesaleCustomer
  items?:          WholesaleInvoiceItem[]
  payments?:       WholesalePayment[]
}

export interface WholesaleInvoiceItem {
  id:          string
  invoice_id:  string
  product_id:  string | null
  description: string
  quantity:    number
  unit_price:  number  // pence
  total_price: number  // pence
  created_at:  string
}

export interface WholesalePayment {
  id:           string
  invoice_id:   string
  customer_id:  string
  amount:       number  // pence
  payment_date: string
  method:       PaymentMethod
  reference:    string | null
  notes:        string | null
  recorded_by:  string | null
  created_at:   string
}

// Summary for dashboard / outstanding balance list
export interface CustomerBalance {
  customer:        WholesaleCustomer
  total_invoiced:  number  // pence
  total_paid:      number  // pence
  balance_due:     number  // pence
  overdue_amount:  number  // pence
  invoice_count:   number
}

// EPOS CSV row shape
export interface EposCsvRow {
  product_name: string
  sku: string
  retail_price_pence: number
  wholesale_price_pence: number
}
