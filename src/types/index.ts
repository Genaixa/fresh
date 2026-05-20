export type ProductCategory = 'fruit' | 'veg' | 'other'
export type ProductUnit     = 'each' | 'kg' | 'box' | 'punnet' | 'bunch' | 'bag'
export type InvoiceStatus   = 'uploaded' | 'processing' | 'processed' | 'error'
export type PriceType       = 'retail' | 'wholesale' | 'purchase'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'auto_applied'
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
  quantity: number
  unit_cost: number             // pence (per box/case)
  total_cost: number            // pence
  units_per_case: number | null // retail units per box, parsed from invoice name
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

// EPOS CSV row shape
export interface EposCsvRow {
  product_name: string
  sku: string
  retail_price_pence: number
  wholesale_price_pence: number
}
