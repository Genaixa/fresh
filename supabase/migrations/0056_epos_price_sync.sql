-- Epos price sync — 9 Jun 2026
--
-- Analysed 2025 full-year + 2026 YTD Epos Now TSV exports.
-- For each product: avg_price = Value / Qty (unit products) or Value / MeasuredQty (weighed products).
-- Used to:
--   (a) Fill in 0p retail prices with confirmed Epos selling prices
--   (b) Fix known wrong epos_now_id links
--   (c) Add products selling in Epos but absent from the products table
--
-- === RETAIL PRICE CORRECTIONS ===

-- Hispi Cabbage: Epos "Cabbage Sweetheart" (10757457), 20 units 2026, avg 100p
UPDATE products SET retail_price = 100 WHERE name = 'Hispi Cabbage';

-- Pomelo: Epos "Pomello" (4592059), 231 units 2026, avg 198p — solid data
UPDATE products SET retail_price = 198, epos_now_id = '4592059' WHERE name = 'Pomelo';

-- Potato Mini: Epos "Mini potatoes 2.5kg" (51657143), 18 units 2026, avg 375p
UPDATE products SET retail_price = 375, epos_now_id = '51657143' WHERE name = 'Potato Mini';

-- Chinese Leaves: Epos "Chinese Leaf" (7927245), 30 units 2026, avg 198p
-- Was 100p in DB. At 88p cost (today's invoice), 198p gives 55% margin vs 12% at 100p.
-- The 100p was almost certainly an old/wrong entry.
UPDATE products SET retail_price = 198 WHERE name = 'Chinese Leaves';

-- Cabbage White: Epos (4590101), 188 units 2026, avg 114p/kg. Was 100p/kg.
UPDATE products SET retail_price = 114 WHERE name = 'Cabbage White';

-- Dragon Fruit: DB had epos_now_id=46128692 which is "Flat Peach 4 for £1" — completely wrong.
-- Correct Epos product is "Red Dragon Fruit" (50207637), 26 units 2026, avg 350p.
-- Also correcting retail: 200p → 350p to match current Epos selling price.
UPDATE products SET retail_price = 350, epos_now_id = '50207637' WHERE name = 'Dragon Fruit';

-- Apricot: epos_now_id=46128454 ("Apricot Loose") is wrong for a 250p product.
-- "Apricot Loose" sells at ~20p/each (individual loose apricots). The "Apricot" product in DB at 250p
-- is a 500g punnet — wrong Epos ID. Clear it until correctly mapped.
UPDATE products SET epos_now_id = NULL WHERE name = 'Apricot';

-- === IMPORTANT ALERTS (not updated — needs David confirmation) ===
--
-- Watermelon Large (epos 48921831 = "Watermelon 4s"): Epos avg 435p in 2026.
-- DB retail is 600p. Cost today = 525p. These melons have historically been sold at ~435p (a loss!).
-- David has now set 600p in DB. At 600p retail and 525p cost = 12.5% margin — just positive.
-- Flag: has David actually updated Epos price to 600p? If still ringing at 435p, losing money.
--
-- Watermelon (epos 52173138 = "watermelon 6s"): Epos avg 400p in 2026. DB retail=450p. Cost=350p.
-- At 450p retail and 350p cost = 22% margin. OK if Epos price is really 450p now.


-- === NEW PRODUCTS (present in Epos, absent from products table) ===

-- Carrot Bag 1KG: pre-packed 1kg carrot bag. 1767 units (2025) + 854 units (2026 YTD) = ~37/wk.
-- Retail avg 129p (2025) rising to 139p (2026). Use 139p.
-- Cost unknown — not on any invoice as a separate line. Purchase cost TBC from next Holland invoice.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Carrot Bag 1KG', 'veg', 'bag', 139, 0, '47064979', true, 37);

-- Potatoes Baby Roast: sold by weight at 225p/kg. 553.67kg (2026 YTD, 22wk) = 25kg/wk.
-- Also 1491.56kg in 2025 (52wk) = 29 kg/wk. Average ~27 kg/wk.
-- This is the baby roast potato product, sold loose by weight. Distinct from Potato Baby (2.5kg pack).
-- Cost TBC — no invoice line for this variety today.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Potato Baby Roast', 'veg', 'kg', 225, 0, '4590143', true, 27);

-- Date Box Small: 580 units (2025) + 439 units (2026 YTD) = ~20/wk, consistently 149p.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Date Box Small', 'fruit', 'each', 149, 0, '51082442', true, 20);

-- Roasted Pistachios: 430 (2025) + 191 (2026 YTD) = ~11/wk, 150p. Non-produce, but sold in-store.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Roasted Pistachios', 'other', 'each', 150, 0, '50153547', true, 11);

-- Roasted Almonds: 277 (2025) + 65 (2026 YTD) = ~5/wk, 150p.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Roasted Almonds', 'other', 'each', 150, 0, '50153533', true, 5);

-- Milk: 9049 (2025) + 4550 (2026 YTD) = ~190/wk at 149p. Second highest volume product in the shop.
-- Not fresh produce, but critical to understand for total revenue picture.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Milk', 'other', 'each', 149, 0, '4592058', true, 190);

-- Eggs Tray Large: 1069 (2025) + 559 (2026 YTD) = ~23/wk. Price rose from 715p to 793p this year.
-- Use current 2026 price: 793p.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Eggs Tray Large', 'other', 'each', 793, 0, '4580448', true, 23);
