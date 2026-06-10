-- Fix four active products with zero cost that have been invoiced recently.

-- ── Strawberry Punnet ─────────────────────────────────────────────────────────
-- Invoice: STRAWBERRY . BELGIUM 8X500G at £18.00 for 1 box
-- Parser missed the 8 in "8X500G" → units_per_case stored as NULL → weighted avg = 1800p → cost-guard Rule 1 blocked (1800p > 180p retail)
-- Fix: set units_per_case=8 on the invoice item → cost per 500g punnet = 1800p/8 = 225p
-- Retail 180p is below cost — raise to 249p (still conservative for a 500g punnet)
UPDATE purchase_invoice_items
SET units_per_case = 8
WHERE product_id = (SELECT id FROM products WHERE name = 'Strawberry Punnet')
  AND product_name_raw ILIKE '%8X500G%';

UPDATE products SET purchase_cost = 225, retail_price = 249 WHERE name = 'Strawberry Punnet';

-- ── Radish ────────────────────────────────────────────────────────────────────
-- Invoice 27 May: RADISH PRE PACKED - X20 DUTCH at £7.50, count/20
-- Outside 7-day weighted-avg window → cost never written
-- Per pack: 750p / 20 = 37.5p → 38p
UPDATE products SET purchase_cost = 38 WHERE name = 'Radish';

-- ── Starfruit ─────────────────────────────────────────────────────────────────
-- Invoice 18 May: STARFRUIT . THAILAND 10 2.5KG at £15.00, count/10
-- Outside 7-day window. Per fruit: 1500p / 10 = 150p. Retail was 100p (below cost) → raise to 199p
UPDATE products SET purchase_cost = 150, retail_price = 199 WHERE name = 'Starfruit';

-- ── Melon Piel de Sapo ────────────────────────────────────────────────────────
-- Invoice 14 May: MELON PIEL DE SAPO CR 9 15KG at £17.00, count/9
-- Outside 7-day window. Per melon: 1700p / 9 = 188.9p → 189p. Retail 250p = 24% margin, fine.
UPDATE products SET purchase_cost = 189 WHERE name = 'Melon Piel de Sapo';
