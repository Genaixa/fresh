-- 0023: Order screen prep
-- • is_internal flag on wholesale_customers (Fresh & Fruity = internal)
-- • unit_type on wholesale_order_items (box | retail_unit, per line)
-- • Insert Fresh & Fruity as internal customer
-- • Insert Deli Stones as future customer placeholder (per client)

-- 1. internal flag
ALTER TABLE wholesale_customers
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- 2. unit type per order line (box = David buys at market; retail_unit = customer's selling unit)
ALTER TABLE wholesale_order_items
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'retail_unit'
  CHECK (unit_type IN ('box', 'retail_unit'));

-- 3. Fresh & Fruity as internal customer (idempotent)
INSERT INTO wholesale_customers (id, name, is_internal, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Fresh & Fruity',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET is_internal = true, name = 'Fresh & Fruity';
