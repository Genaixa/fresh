-- 0098: Replace the seed/demo suppliers with the real three.
--
-- The suppliers table held two early placeholders (Gateshead Wholesale,
-- Newcastle Fruit Market) that don't match reality. The real supplier was only
-- recorded as free text on each purchase_invoice. This migration:
--   1. Repurposes the two seed rows into real suppliers (keeps every FK intact —
--      products.default_supplier_id, product_suppliers, market_session_items,
--      purchase_invoices all keep pointing at valid rows).
--   2. Adds Thomas Baty.
--   3. Fixes invoice DN259049, mis-parsed as our own company
--      "FRESH N FRUITY (GHD) LTD" — it's a Thomas Baty potato note (sweet/washed
--      potato; DN259049 sits inside Baty's DN-number run).
--   4. Normalises the two Baty spellings to one canonical name.
--   5. Re-points purchase_invoices.supplier_id from the corrected supplier_name.

BEGIN;

-- 1. Repurpose the two seed rows into real suppliers.
UPDATE suppliers SET name = 'Total Produce', market_order = 1
  WHERE id = '11111111-0000-0000-0000-000000000002';   -- was Gateshead Wholesale
UPDATE suppliers SET name = 'JR Holland', market_order = 2
  WHERE id = '11111111-0000-0000-0000-000000000001';   -- was Newcastle Fruit Market

-- 2. Add Thomas Baty.
INSERT INTO suppliers (id, name, market_order, is_active)
  VALUES ('11111111-0000-0000-0000-000000000003', 'Thomas Baty', 3, true)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, market_order = EXCLUDED.market_order;

-- 3. Fix the mis-parsed recipient name (DN259049 = Thomas Baty potato note).
UPDATE purchase_invoices SET supplier_name = 'Thomas Baty'
  WHERE supplier_name = 'FRESH N FRUITY (GHD) LTD';

-- 4. Normalise Baty spelling variants to one canonical name.
UPDATE purchase_invoices SET supplier_name = 'Thomas Baty'
  WHERE supplier_name ILIKE '%baty%';

-- 5. Re-point supplier_id from the (now-correct) supplier_name.
UPDATE purchase_invoices SET supplier_id = '11111111-0000-0000-0000-000000000002'
  WHERE supplier_name = 'Total Produce';
UPDATE purchase_invoices SET supplier_id = '11111111-0000-0000-0000-000000000001'
  WHERE supplier_name = 'JR Holland';
UPDATE purchase_invoices SET supplier_id = '11111111-0000-0000-0000-000000000003'
  WHERE supplier_name = 'Thomas Baty';

COMMIT;
