-- June 2026 EPOS "Sales by Product" (1–12 Jun, ~1.6 weeks, 6,153 transactions).
-- Two things:
--  (A) weekly_units_recent = in-season sales rate (kg/wk for weighed, units/wk
--      for counted). Buying guide prefers this over the 283-week blend.
--  (B) The MeasuredQty column shows which items the till WEIGHS — resolving
--      several sell-unit questions without David: value÷kg matches the shelf
--      price exactly where sold per kg.

ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_units_recent integer;

-- ── (B) resolutions ────────────────────────────────────────────────────────
-- Red Cabbage: till £6.21 / 3.27kg = £1.90/kg → sold PER KG, so the 50p/kg
-- cost (£5 box ÷ 10kg) was right all along. Unit label fixed, question closed.
UPDATE products SET unit='kg', needs_review=false WHERE name='Red Cabbage';

-- Kohlrabi: till £112.16 / 26.70kg = £4.20/kg → already weighed at the till,
-- so the small/large-buttons question is moot. Cost: £17 box ÷ 8kg (David,
-- batch 2) = £2.13/kg.
UPDATE products SET unit='kg', purchase_cost=213, needs_review=false WHERE name='Kohlrabi';

-- Swede: till £20.88 / 13.05kg = £1.60/kg → per kg. £8 box ÷ 10kg (David,
-- batch 2) = 80p/kg — cost already right, just the unit label.
UPDATE products SET unit='kg' WHERE name='Swede';

-- Tomato (loose/vine): till £201.05 / 41.89kg = £4.80/kg — customers really do
-- pay £4.80/kg, and the ~85p/kg cost is invoice-backed. Question closed.
UPDATE products SET needs_review=false WHERE name='Tomato';

-- Leek: till £72.17 / 22.55kg = £3.20/kg → sold per kg (unit fixed), but the
-- £7.20 wood box has no recorded weight, so cost stays unconfirmed.
UPDATE products SET unit='kg' WHERE name='Leek';

-- Butternut Squash: NEW discrepancy — till weighs it (£113.20 / 43.75kg =
-- £2.59/kg ≈ the £2.60 "each" price), so cost-per-each vs price-per-kg don't
-- compare. Needs the box weight from David.
UPDATE products SET needs_review=true WHERE name='Butternut Squash';

-- ── (A) June sales rates (qty or kg ÷ 1.6 weeks) ──────────────────────────
-- Weighed items (kg/week)
UPDATE products SET weekly_units_recent=8   WHERE name='Apple Bramley';
UPDATE products SET weekly_units_recent=21  WHERE name='Apple Braeburn';
UPDATE products SET weekly_units_recent=21  WHERE name='Apple Royal Gala';
UPDATE products SET weekly_units_recent=13  WHERE name='Apple Golden Delicious';
UPDATE products SET weekly_units_recent=5   WHERE name='Apple Granny Smith';
UPDATE products SET weekly_units_recent=16  WHERE name='Apple Pink Lady';
UPDATE products SET weekly_units_recent=26  WHERE name='Aubergine';
UPDATE products SET weekly_units_recent=97  WHERE name='Banana';
UPDATE products SET weekly_units_recent=4   WHERE name='Beetroot';
UPDATE products SET weekly_units_recent=27  WHERE name='Cabbage White';
UPDATE products SET weekly_units_recent=151 WHERE name='Carrot Loose';
UPDATE products SET weekly_units_recent=54  WHERE name='Courgette';
UPDATE products SET weekly_units_recent=17  WHERE name='Kohlrabi';
UPDATE products SET weekly_units_recent=14  WHERE name='Leek';
UPDATE products SET weekly_units_recent=13  WHERE name='Onion Red';
UPDATE products SET weekly_units_recent=119 WHERE name='Onion Regular';
UPDATE products SET weekly_units_recent=76  WHERE name='Onion Spanish';
UPDATE products SET weekly_units_recent=9   WHERE name='Parsnip';
UPDATE products SET weekly_units_recent=9   WHERE name='Pea';
UPDATE products SET weekly_units_recent=34  WHERE name='Pear Conference';
UPDATE products SET weekly_units_recent=50  WHERE name='Pepper (Red)';
UPDATE products SET weekly_units_recent=3   WHERE name='Pepper (Yellow)';
UPDATE products SET weekly_units_recent=4   WHERE name='Plums Loose';
UPDATE products SET weekly_units_recent=22  WHERE name='Potato Loose';
UPDATE products SET weekly_units_recent=8   WHERE name='Swede';
UPDATE products SET weekly_units_recent=72  WHERE name='Sweet Potato';
UPDATE products SET weekly_units_recent=42  WHERE name='Tangerine';
UPDATE products SET weekly_units_recent=26  WHERE name='Tomato';
UPDATE products SET weekly_units_recent=3   WHERE name='Tomato Cherry Vine';
UPDATE products SET weekly_units_recent=6   WHERE name='Mushroom Regular';
UPDATE products SET weekly_units_recent=2   WHERE name='Red Cabbage';

-- Counted items (units/week)
UPDATE products SET weekly_units_recent=14  WHERE name='Potato Bag';            -- "7.5 KG Potato"
UPDATE products SET weekly_units_recent=161 WHERE name='Avocado';
UPDATE products SET weekly_units_recent=13  WHERE name='Blueberry';
UPDATE products SET weekly_units_recent=6   WHERE name='Bean Fine';
UPDATE products SET weekly_units_recent=24  WHERE name='Celery';
UPDATE products SET weekly_units_recent=11  WHERE name='Celeriac';
UPDATE products SET weekly_units_recent=16  WHERE name='Salad Cress';
UPDATE products SET weekly_units_recent=523 WHERE name='Cucumber';
UPDATE products SET weekly_units_recent=22  WHERE name='Garlic Loose';          -- "Garlic Bulb" 35 sold
UPDATE products SET weekly_units_recent=13  WHERE name='Garlic Prepack';
UPDATE products SET weekly_units_recent=19  WHERE name='Grapefruit';
UPDATE products SET weekly_units_recent=79  WHERE name='Grapes';                -- closed punnets
UPDATE products SET weekly_units_recent=49  WHERE name='Kiwi Loose';
UPDATE products SET weekly_units_recent=65  WHERE name='Lemon';
UPDATE products SET weekly_units_recent=9   WHERE name='Lettuce Iceberg';
UPDATE products SET weekly_units_recent=23  WHERE name='Lettuce Cos';
UPDATE products SET weekly_units_recent=79  WHERE name='Mango';
UPDATE products SET weekly_units_recent=8   WHERE name='Melon Cantaloupe';
UPDATE products SET weekly_units_recent=3   WHERE name='Melon Galia';
UPDATE products SET weekly_units_recent=13  WHERE name='Melon Honeydew';
UPDATE products SET weekly_units_recent=8   WHERE name='Mushroom Button';       -- button tubs
UPDATE products SET weekly_units_recent=90  WHERE name='Mushroom Punnet';       -- 131 + 13 tubs
UPDATE products SET weekly_units_recent=60  WHERE name='Nectarine Punnet';
UPDATE products SET weekly_units_recent=34  WHERE name='Nectarine';             -- "nectarine large" @£2.99
UPDATE products SET weekly_units_recent=45  WHERE name='Oranges Large';
UPDATE products SET weekly_units_recent=143 WHERE name='Passion Fruit';         -- 76×3 + 1 single
UPDATE products SET weekly_units_recent=18  WHERE name='Pepper (Mixed)';
UPDATE products SET weekly_units_recent=6   WHERE name='Physalis';
UPDATE products SET weekly_units_recent=12  WHERE name='Pineapple';
UPDATE products SET weekly_units_recent=207 WHERE name='Potato (Bag 2kg)';
UPDATE products SET weekly_units_recent=21  WHERE name='Potato Mini';           -- Miniature Salad 2.5kg
UPDATE products SET weekly_units_recent=3   WHERE name='Potato Sack';
UPDATE products SET weekly_units_recent=6   WHERE name='Radish';
UPDATE products SET weekly_units_recent=1   WHERE name='Shallot';
UPDATE products SET weekly_units_recent=13  WHERE name='Strawberry Punnet';     -- punnet buttons combined
UPDATE products SET weekly_units_recent=3   WHERE name='Strawberry';            -- Belgian punnet
UPDATE products SET weekly_units_recent=13  WHERE name='Sugarsnap';
UPDATE products SET weekly_units_recent=52  WHERE name='Tomato Cherry';         -- cherry punnets
UPDATE products SET weekly_units_recent=19  WHERE name='Watermelon Large';      -- 4s + "large watermelon"
UPDATE products SET weekly_units_recent=18  WHERE name='Watermelon';            -- 6s
UPDATE products SET weekly_units_recent=15  WHERE name='Watermelon Small';
UPDATE products SET weekly_units_recent=2   WHERE name='Papaya';
UPDATE products SET weekly_units_recent=197 WHERE name='Lychee';                -- 63 × "5 for £1"
UPDATE products SET weekly_units_recent=3   WHERE name='Chinese Leaves';
