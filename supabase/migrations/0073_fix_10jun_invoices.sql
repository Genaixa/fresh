-- Fix 10 Jun 2026 invoices:
-- 1. Delete duplicate Dole invoice (23-item original, superseded by 24-item amended version)
-- 2. Backfill product matches for the 6 items that were unmatched at ingestion time
-- 3. Update purchase costs for the newly-matched products
-- 4. Add supplier mappings so these raw descriptions match automatically from tomorrow

-- ── 1. Delete the duplicate (incomplete) Dole invoice ─────────────────────────
DELETE FROM price_suggestions   WHERE invoice_id = '9eb607f1-9788-4aae-910c-e31b19e1f8e0';
DELETE FROM purchase_invoice_items WHERE invoice_id = '9eb607f1-9788-4aae-910c-e31b19e1f8e0';
DELETE FROM purchase_invoices   WHERE id            = '9eb607f1-9788-4aae-910c-e31b19e1f8e0';

-- ── 2a. Fix unmatched items in the remaining Dole invoice (81743f29) ─────────
-- Satsuma Peru → Tangerine (70 per 10kg box → count/70)
UPDATE purchase_invoice_items
SET is_matched     = true,
    product_id     = '3d4f1023-ca6a-413c-8018-384a605c4c42',
    unit_type      = 'count',
    units_per_case = 70,
    box_weight_kg  = NULL
WHERE invoice_id      = '81743f29-4cd6-4e16-8a9d-6618ecb04310'
  AND product_name_raw ILIKE '%SATSUMA%PERU%';

-- Plum Red Beauty Spain 5kg → Plums Loose (weight / 5 kg)
UPDATE purchase_invoice_items
SET is_matched = true,
    product_id = '72006aef-fabd-425e-bca7-439587c674b1'
WHERE invoice_id      = '81743f29-4cd6-4e16-8a9d-6618ecb04310'
  AND product_name_raw ILIKE '%PLUM RED BEAUTY%';

-- Orange Navel Spain 40 15kg → Oranges Large (40 per box → count/40)
UPDATE purchase_invoice_items
SET is_matched     = true,
    product_id     = 'bf7fd091-e669-447a-930c-ced5b1d40399',
    unit_type      = 'count',
    units_per_case = 40,
    box_weight_kg  = NULL
WHERE invoice_id      = '81743f29-4cd6-4e16-8a9d-6618ecb04310'
  AND product_name_raw ILIKE '%ORANGE NAVEL%';

-- Grape Sugar Crisp prepacked → Grapes (10 × 500g punnets → count/10)
UPDATE purchase_invoice_items
SET is_matched = true,
    product_id = 'df8d618e-d7da-4755-b47c-b89217b80d50'
WHERE invoice_id      = '81743f29-4cd6-4e16-8a9d-6618ecb04310'
  AND product_name_raw ILIKE '%GRAPE SUGAR CRISP%';

-- ── 2b. Fix unmatched items in JR Holland invoices ────────────────────────────
-- Iceberg X10 Summoms → Lettuce Iceberg (10 per case → count/10)
UPDATE purchase_invoice_items
SET is_matched = true,
    product_id = 'ed592873-f7ad-4486-b10e-fbfc3205aa01'
WHERE invoice_id      = '7b80b7ae-85e2-4fd6-b83b-05cd6a7ecb1a'
  AND product_name_raw ILIKE '%ICEBERG%SUMMOMS%';

-- Mids Jazzy → Potato Mids (10 kg bag → weight/10kg)
UPDATE purchase_invoice_items
SET is_matched     = true,
    product_id     = 'a64175dd-856a-4534-918b-0f772e3d1025',
    unit_type      = 'weight',
    units_per_case = NULL,
    box_weight_kg  = 10
WHERE invoice_id      = '516c68e5-6a62-41f5-844b-a7702b5d79b0'
  AND product_name_raw ILIKE '%JAZZY%';

-- ── 3. Update purchase costs from today's invoice data ────────────────────────
-- Lettuce Iceberg: £6.60 / 10 = 66p each
UPDATE products SET purchase_cost = 66 WHERE id = 'ed592873-f7ad-4486-b10e-fbfc3205aa01';

-- Tangerine: £16.00 / 70 = 22.9p ≈ 23p each
UPDATE products SET purchase_cost = 23 WHERE id = '3d4f1023-ca6a-413c-8018-384a605c4c42';

-- Plums Loose: £15.00 / 5kg = 300p/kg
UPDATE products SET purchase_cost = 300 WHERE id = '72006aef-fabd-425e-bca7-439587c674b1';

-- Oranges Large: £20.00 / 40 = 50p each
UPDATE products SET purchase_cost = 50 WHERE id = 'bf7fd091-e669-447a-930c-ced5b1d40399';

-- Grapes: both varieties £17.00 / 10 punnets = 170p per 500g punnet
UPDATE products SET purchase_cost = 170 WHERE id = 'df8d618e-d7da-4755-b47c-b89217b80d50';

-- Potato Mids: weighted avg Dole 75p/kg + Holland Jazzy 70p/kg ≈ 73p/kg
-- (3×7500 + 3×7000) / (3×10 + 3×10)kg = 43500/60 = 725p → 73p
UPDATE products SET purchase_cost = 73 WHERE id = 'a64175dd-856a-4534-918b-0f772e3d1025';

-- ── 4. Add supplier mappings for future invoices ──────────────────────────────
INSERT INTO supplier_product_mappings
  (supplier_name, raw_description, product_id, unit_type, units_per_case, box_weight_kg, status)
VALUES
  ('JR Holland',    'ICEBERG - X10 SUMMOMS',                       'ed592873-f7ad-4486-b10e-fbfc3205aa01', 'count',  10,   NULL, 'confirmed'),
  ('JR Holland',    'MIDS - JAZZY',                                'a64175dd-856a-4534-918b-0f772e3d1025', 'weight', NULL, 10.0, 'confirmed'),
  ('Total Produce', 'SATSUMA. PERU 70 10KG.',                      '3d4f1023-ca6a-413c-8018-384a605c4c42', 'count',  70,   NULL, 'confirmed'),
  ('Total Produce', 'SATSUMA, PERU 70 10KG.',                      '3d4f1023-ca6a-413c-8018-384a605c4c42', 'count',  70,   NULL, 'confirmed'),
  ('Total Produce', 'PLUM RED BEAUTY SPAIN. 5KG.',                 '72006aef-fabd-425e-bca7-439587c674b1', 'weight', NULL, 5.0,  'confirmed'),
  ('Total Produce', 'ORANGE NAVEL SPAIN 40 15KG.',                 'bf7fd091-e669-447a-930c-ced5b1d40399', 'count',  40,   NULL, 'confirmed'),
  ('Total Produce', 'GRAPE SUGAR CRISP ES 10X500G 5KG PREPACKED',  'df8d618e-d7da-4755-b47c-b89217b80d50', 'count',  10,   NULL, 'confirmed')
ON CONFLICT DO NOTHING;
