-- 1. Fix product_supplier_last_price view — was requiring is_matched=true,
--    which excluded all programmatically-linked items (the bulk of our data).
--    Now uses product_id IS NOT NULL instead.

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
    WHEN pi.supplier_name ILIKE '%dole%'    THEN 'dole wholesale gateshead'
    WHEN pi.supplier_name ILIKE '%holland%' THEN 'jr holland'
    ELSE NULL
  END AS mapped_supplier
) s
WHERE pii.product_id IS NOT NULL
  AND s.mapped_supplier IS NOT NULL
ORDER BY pii.product_id, s.mapped_supplier, pi.invoice_date DESC, pii.id DESC;

-- 2. Mushroom Regular: set retail_price from EPOS ("Mushroom 4.58" = £4.58/kg)
--    purchase_cost from latest invoice: £5.20 / 2.27kg = 229p/kg
UPDATE products SET retail_price = 458, purchase_cost = 229 WHERE name = 'Mushroom Regular';

-- 3. Mushroom Button: now a count/punnet item (12 punnets per box)
--    retail_price = 125p per punnet (EPOS "Mushroom Punnet £1.25")
--    purchase_cost from latest Holland invoice: £5.40 / 12 = 45p per punnet (loose equiv)
--    Note: the 12-pack at £8.80 = 73p/punnet, loose at £5.40 treated as 12 loose = 45p/punnet
UPDATE products SET retail_price = 125, purchase_cost = 73, case_size = 12 WHERE name = 'Mushroom Button';
