-- Current Epos Now price list sync — 9 Jun 2026
--
-- David provided the live Epos product list (name / category / price).
-- This is the authoritative source. Some prices we derived from TSV averages
-- were WRONG (averages included old pricing periods). Corrections below.
--
-- === CORRECTIONS FROM MIGRATION 0056 ===
-- Chinese Leaves: we updated to 198p based on TSV average. Epos list says £1.00. Revert.
-- Cabbage White: we updated to 114p. Epos says £1.00. Revert.
-- Dragon Fruit: we updated to 350p. Epos says £2.00. Revert. Also fix epos_now_id.
-- Carrot Bag 1KG: we inserted at 139p. Epos says £1.00. Correct.
-- Eggs Tray Large: we inserted at 793p. Epos says £7.90. Minor fix.

UPDATE products SET retail_price = 100 WHERE name = 'Chinese Leaves';
UPDATE products SET retail_price = 100 WHERE name = 'Cabbage White';

-- Dragon Fruit: Epos "Dragon Fruit" (Exotic) = £2.00. Epos ID 45702915 from 2025 TSV data.
-- Previous epos_now_id (50207637 = "Red Dragon Fruit" at 350p avg) was wrong.
UPDATE products SET retail_price = 200, epos_now_id = '45702915' WHERE name = 'Dragon Fruit';

UPDATE products SET retail_price = 100 WHERE name = 'Carrot Bag 1KG';
UPDATE products SET retail_price = 790 WHERE name = 'Eggs Tray Large';

-- === RETAIL PRICE UPDATES FROM EPOS LIST ===

-- Plums Punnet: was 100p in DB. Epos says £1.99. DB was clearly wrong.
UPDATE products SET retail_price = 199 WHERE name = 'Plums Punnet';

-- Apricot (individual loose): Epos "Apricot Loose" = £0.20 each. We cleared epos_now_id in 0056
-- thinking it was wrongly linked — but it WAS the right Epos product, just the retail_price was wrong
-- (250p was the punnet price, not individual apricot). Fix: 250p → 20p, restore epos_now_id.
UPDATE products SET retail_price = 20, epos_now_id = '46128454' WHERE name = 'Apricot';

-- Potato Sack: Epos "Sack of Potato 10x2kg" = £13.00 (epos 52169649, already linked).
-- Cost = 10 bags × 85p (from Dole #11219925 5 Jun: UK 10×2KG @ £8.50/case = 85p/bag).
UPDATE products SET retail_price = 1300, purchase_cost = 850 WHERE name = 'Potato Sack';

-- Chestnuts: Epos = £0.10 each. Was 0p. Probably seasonal, sold individually.
UPDATE products SET retail_price = 10 WHERE name = 'Chestnuts';

-- === EPOS ID CORRECTION ===
-- DB "Nectarine" linked to epos 46073190 ("Nectarine Punnet" = £2.50 in Epos).
-- But DB retail is 299p which matches "nectarine large" (epos 52186058, £2.99).
-- Fix the ID. "Nectarine Punnet" (£2.50) is a separate product — add below.
UPDATE products SET epos_now_id = '52186058' WHERE name = 'Nectarine';

-- === NEW PRODUCTS FROM EPOS LIST ===

-- Nectarine Punnet: £2.50 per 500g punnet (Epos 46073190). Distinct from large 1kg punnet (£2.99).
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Nectarine Punnet', 'fruit', 'punnet', 250, 0, '46073190', true, 0);

-- Watermelon Small: Epos £4.00 — listed alongside "Watermelon 6s" (£4.50). Possibly smaller size
-- or a second price point David uses for smaller/lower-quality melons from the same box.
-- NOTE: no separate invoice line for this today. Cost same as Watermelon (350p from size-6 box).
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Watermelon Small', 'fruit', 'each', 400, 350, NULL, true, 0);

-- Sweet Pepper: Epos £1.00 (category: Peppers). Likely a small bag or punnet of mini sweet peppers.
-- This is distinct from DB "Pepper (Orange)" at 50p (which may be a single bell pepper).
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Sweet Pepper', 'veg', 'each', 100, 0, NULL, true, 0);

-- Little Gem: Epos £1.29. Small compact lettuce variety.
INSERT INTO products (name, category, unit, retail_price, purchase_cost, epos_now_id, is_active, weekly_units)
VALUES ('Lettuce Little Gem', 'veg', 'each', 129, 0, NULL, true, 0);

-- === IMPORTANT ALERT — NEEDS DAVID'S ACTION IN EPOS NOW ===
-- Old lychee products still active in Epos:
--   "Litchi" at £5.90 and "Lychees" at £6.00 — these are the old prices before David confirmed
--   5 for £1 (20p each). If customers are rung on these, they pay £5.90/£6.00 instead of £1.00 for 5.
-- David must DEACTIVATE "Litchi" and "Lychees" in Epos Now back office.
-- Correct products are "Lychee single" (20p) and "Lychees 5 for £1" (£1.00).
--
-- Also: "Litchi box" (Wholesale £9.50) in Epos — is this a separate wholesale product or legacy?
--
-- UNKNOWN PRODUCTS (need David to explain):
--   "Sheciyonu" (£13.20) and "SEHECYIONU" (£6.60) — what are these? Etrog for Sukkot?
