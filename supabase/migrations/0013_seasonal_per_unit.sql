-- ============================================================
-- Rebuild product_seasonal_averages for per-unit pricing.
--
-- Old: avg_price_pence was per-box — meaningless when the same
--   product (e.g. Watermelon) comes in 3-count, 5-count, 9-count
--   boxes. Averaging box prices across different formats is wrong.
--
-- New: avg_price_per_unit_pence is per-kg (weight products) or
--   per-piece (count products). All formats of the same product
--   now produce a comparable number.
--
-- PK changes from (product_id, month_number) to
--   (product_id, month_number, unit_type) so weight and count
--   seasonal averages can coexist for mixed products.
-- ============================================================

-- 1. Wipe existing (wrong) data
TRUNCATE product_seasonal_averages;

-- 2. Drop old primary key
ALTER TABLE product_seasonal_averages
  DROP CONSTRAINT product_seasonal_averages_pkey;

-- 3. Rename per-box column → per-unit column
ALTER TABLE product_seasonal_averages
  RENAME COLUMN avg_price_pence TO avg_price_per_unit_pence;

-- 4. Add unit_type
ALTER TABLE product_seasonal_averages
  ADD COLUMN unit_type text NOT NULL DEFAULT 'weight'
  CHECK (unit_type IN ('weight', 'count'));

ALTER TABLE product_seasonal_averages
  ALTER COLUMN unit_type DROP DEFAULT;

-- 5. New primary key includes unit_type
ALTER TABLE product_seasonal_averages
  ADD PRIMARY KEY (product_id, month_number, unit_type);

-- ────────────────────────────────────────────────────────────
-- market_session_items: record which box size David actually
-- bought, so we can reconstruct the per-unit cost later.
-- ────────────────────────────────────────────────────────────
ALTER TABLE market_session_items
  ADD COLUMN IF NOT EXISTS box_size  numeric(8,2),
  ADD COLUMN IF NOT EXISTS unit_type text CHECK (unit_type IN ('weight', 'count'));
