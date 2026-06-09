-- Normalise supplier names so the market page's price lookups actually work.
--
-- The market page and product_supplier_last_price view use two canonical keys:
--   'dole wholesale gateshead'  → Total Produce (their market stall)
--   'jr holland'                → JR Holland
--
-- The supplier_product_mappings table had several variants that matched neither.

-- 1. Normalise Total Produce variants → 'dole wholesale gateshead'
UPDATE supplier_product_mappings
SET supplier_name = 'dole wholesale gateshead'
WHERE supplier_name IN ('total produce', 'Total Produce');

-- 2. Normalise JR Holland variants → 'jr holland'
--    Drop duplicates first (same raw_description already exists under 'jr holland')
DELETE FROM supplier_product_mappings
WHERE supplier_name IN ('jrholland', 'jrholland produce')
  AND EXISTS (
    SELECT 1 FROM supplier_product_mappings s2
    WHERE s2.supplier_name = 'jr holland'
      AND s2.raw_description = supplier_product_mappings.raw_description
  );

UPDATE supplier_product_mappings
SET supplier_name = 'jr holland'
WHERE supplier_name IN ('jrholland', 'jrholland produce');

-- 3. Fix product_supplier_last_price view to match 'Total Produce' invoices.
--    Previously only matched supplier names containing 'dole' — our invoices
--    say 'Total Produce', so the Dole column was always empty.
CREATE OR REPLACE VIEW product_supplier_last_price AS
SELECT DISTINCT ON (pii.product_id, s.mapped_supplier)
    pii.product_id,
    s.mapped_supplier AS supplier_name,
    pii.unit_cost     AS last_price_p,
    pi.invoice_date   AS last_date
FROM purchase_invoice_items pii
JOIN purchase_invoices pi ON pi.id = pii.invoice_id
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN pi.supplier_name ~~* '%total produce%' THEN 'dole wholesale gateshead'
        WHEN pi.supplier_name ~~* '%dole%'          THEN 'dole wholesale gateshead'
        WHEN pi.supplier_name ~~* '%holland%'       THEN 'jr holland'
        ELSE NULL
    END AS mapped_supplier
) s
WHERE pii.product_id IS NOT NULL AND s.mapped_supplier IS NOT NULL
ORDER BY pii.product_id, s.mapped_supplier, pi.invoice_date DESC, pii.id DESC;
