-- Create purchase_suppliers table (the people David buys FROM)
-- Distinct from the 'suppliers' table which holds his wholesale CUSTOMERS.

CREATE TABLE purchase_suppliers (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE purchase_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated reads purchase_suppliers" ON purchase_suppliers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "owner manages purchase_suppliers" ON purchase_suppliers
  FOR ALL USING (current_user_role() = 'owner');

-- Known purchase suppliers
INSERT INTO purchase_suppliers (id, name) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', 'JR Holland'),
  ('aaaaaaaa-0002-0000-0000-000000000002', 'Total Produce'),
  ('aaaaaaaa-0003-0000-0000-000000000003', 'Thomas Baty'),
  ('aaaaaaaa-0004-0000-0000-000000000004', 'Redbridge Produce'),
  ('aaaaaaaa-0005-0000-0000-000000000005', 'Newcastle Market');

-- Add default_supplier_id to products
ALTER TABLE products ADD COLUMN default_supplier_id uuid REFERENCES purchase_suppliers(id);

-- Auto-populate: assign most-common purchase supplier per product
-- based on confirmed supplier_product_mappings
WITH normalised AS (
  SELECT
    product_id,
    CASE
      WHEN lower(supplier_name) IN ('jr holland','jrholland','jrholland produce')
        THEN 'aaaaaaaa-0001-0000-0000-000000000001'::uuid
      WHEN lower(supplier_name) IN ('total produce','dole')
        THEN 'aaaaaaaa-0002-0000-0000-000000000002'::uuid
      WHEN lower(supplier_name) LIKE 'redbridge%'
        THEN 'aaaaaaaa-0004-0000-0000-000000000004'::uuid
    END AS ps_id,
    COUNT(*) AS cnt
  FROM supplier_product_mappings
  WHERE status = 'confirmed'
  GROUP BY product_id, ps_id
),
best AS (
  SELECT DISTINCT ON (product_id) product_id, ps_id
  FROM normalised
  WHERE ps_id IS NOT NULL
  ORDER BY product_id, cnt DESC
)
UPDATE products p
SET default_supplier_id = best.ps_id
FROM best
WHERE p.id = best.product_id;

-- Thomas Baty supplies Potato (Soraya) — set explicitly
UPDATE products
SET default_supplier_id = 'aaaaaaaa-0003-0000-0000-000000000003'
WHERE name = 'Potato (Soraya)';
