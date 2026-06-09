-- David's replies 9 Jun 2026
--
-- Grapefruit (72p), Grapes (£2.29), Melon Cantaloupe (£2.50): already updated via
-- price suggestions page — DB already correct, no change needed here.
--
-- Lychee: DB had wrong retail (590p) and wrong cost (800p = £8/kg stored as per-unit).
--   Actual selling price: 5 for £1 = 20p each.
--   Actual cost: £16 per 2kg bag ÷ 90 avg lychees = 17.8p ≈ 18p per unit.
--   Margin: (20-18)/20 = 10%. Low but positive. David treating as seasonal loss leader.
UPDATE products
SET retail_price = 20,
    purchase_cost = 18,
    weekly_units = 20
WHERE name = 'Lychee';

-- Carrot Prepack: discontinued — winter/seasonal product, David has stopped buying.
UPDATE products
SET is_active = false
WHERE name = 'Carrot Prepack';
