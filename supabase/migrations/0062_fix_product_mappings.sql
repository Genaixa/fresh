-- ─────────────────────────────────────────────────────────────────────────────
-- 0062 Fix product mappings
--
-- 1. Potato Mids (JR Holland): 22.5kg box / 9 bags of 2.5kg / £4.99 bag
--    case_size was 1, corrected to 9.
--
-- 2. Potato Venezia (Total Produce): 10kg box £7.50, sold loose at £2.25/kg.
--    Invoice items were wrongly mapped to Potato Mids.
--    Creates "Potato Venezia" and remaps 50 invoice items + 7 supplier mappings.
--
-- 3. CHILEAN - SIZE 1 (JR Holland): Spanish onion / large onion, NOT avocado.
--    6 invoice items remapped from Avocado → Onion Spanish.
--    Supplier mapping added.
--
-- 4. Apple Cripps Pink: retail £2.99 (confirmed — "Pink Lady Tub" on till).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Potato Mids (JR bags) ─────────────────────────────────────────────────
UPDATE products
SET case_size = 9
WHERE name = 'Potato Mids';

UPDATE supplier_product_mappings
SET units_per_case = 9
WHERE supplier_name ILIKE '%jr%holland%'
  AND raw_description ILIKE '%mids%';

-- ── 2. Potato Venezia (Total Produce loose baby potatoes) ────────────────────
INSERT INTO products (name, purchase_cost, retail_price, case_size, is_active, margin_floor)
VALUES ('Potato Venezia', 75, 225, 10, true, 0.20);

UPDATE purchase_invoice_items pii
SET product_id = (SELECT id FROM products WHERE name = 'Potato Venezia')
FROM purchase_invoices pi
WHERE pi.id = pii.invoice_id
  AND pi.supplier_name ILIKE '%total%produce%'
  AND pii.product_id = (SELECT id FROM products WHERE name = 'Potato Mids')
  AND pii.product_name_raw ILIKE '%potato mids%';

UPDATE supplier_product_mappings
SET product_id = (SELECT id FROM products WHERE name = 'Potato Venezia')
WHERE supplier_name ILIKE '%total%produce%'
  AND (
    raw_description ILIKE '%potato mids washed%'
    OR raw_description ILIKE '%potato mids uk%'
  );

-- ── 3. CHILEAN - SIZE 1 → Onion Spanish ──────────────────────────────────────
INSERT INTO supplier_product_mappings
  (supplier_name, raw_description, product_id, unit_type, status)
VALUES (
  'jr holland',
  'CHILEAN - SIZE 1',
  (SELECT id FROM products WHERE name = 'Onion Spanish'),
  'count',
  'confirmed'
)
ON CONFLICT (supplier_name, raw_description) DO UPDATE
  SET product_id = EXCLUDED.product_id,
      status     = 'confirmed';

UPDATE purchase_invoice_items
SET product_id = (SELECT id FROM products WHERE name = 'Onion Spanish')
WHERE product_name_raw ILIKE '%chilean%'
  AND (
    product_id = (SELECT id FROM products WHERE name = 'Avocado')
    OR product_id IS NULL
  );

-- ── 4. Apple Cripps Pink retail price ────────────────────────────────────────
UPDATE products
SET retail_price = 299
WHERE name = 'Apple Cripps Pink';

-- ── Clean up stale price suggestions ─────────────────────────────────────────
DELETE FROM price_suggestions
WHERE status = 'pending'
  AND product_id IN (
    SELECT id FROM products
    WHERE name IN ('Potato Mids', 'Potato Venezia', 'Onion Spanish', 'Apple Cripps Pink')
  );
