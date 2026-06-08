-- David's replies 8 Jun 2026: confirmed/updated retail prices

-- Kiwi: raised from 45p to 55p (still below 20% floor at 37p cost but can't go higher)
UPDATE products SET retail_price = 55 WHERE name = 'Kiwi Loose';

-- Watermelon 6s (small): raised from £4.00 to £4.50 (cost 350p → 22% margin ✓)
UPDATE products SET retail_price = 450 WHERE name = 'Watermelon';

-- Watermelon Large 4s: £6.00 each (cost 500p → 16.7% margin — David accepting this)
UPDATE products SET retail_price = 600 WHERE name = 'Watermelon Large';

-- Grapes Flame closed punnet: £2.29 (cost 180p → 21.4% margin ✓)
UPDATE products SET retail_price = 229 WHERE name = 'Grapes';

-- Grapefruit: 72p (cost 57p → 20.8% margin ✓ — just clears the floor)
UPDATE products SET retail_price = 72 WHERE name = 'Grapefruit';

-- Melon Cantaloupe: David changed to £2.50 in EPOS (cost 200p → 20% margin ✓)
UPDATE products SET retail_price = 250 WHERE name = 'Melon Cantaloupe';

-- Apple Bramley: confirmed £3.32/kg (not per apple). Fix unit each→kg.
-- Cost unknown from invoices; 12kg box but no Dole line item seen yet.
UPDATE products SET unit = 'kg' WHERE name = 'Apple Bramley';

-- Passion Fruit: intentional loss leader — 3 for £1 drives footfall.
-- Count confirmed 30–40 per box (avg 35 → cost ≈ 39p each = breakeven).
-- No price change. Leave at 39p retail / 34p cost.
