-- Dole invoices #11218078 and #11219925 + J.R. Holland (05/06/2026)

-- ============================================================
-- PURCHASE COST UPDATES FROM 5 JUNE DELIVERIES
-- ============================================================

-- Aubergine: Holland invoice £4.80/box ÷ 5 kg = 96p/kg
-- (migration 0038 used older £5.50 figure; this supersedes it)
UPDATE products SET purchase_cost = 96 WHERE name = 'Aubergine';

-- Grape Flame: Dole £19.00 ÷ 10 × 500g punnets = 190p/punnet
-- (two deliveries on same day: £18.00 and £19.00; taking higher/latest)
UPDATE products SET purchase_cost = 190 WHERE name = 'Grapes';

-- Potato 2kg prepacked bags: Dole £8.50 ÷ 10 bags = 85p/bag
UPDATE products SET purchase_cost = 85 WHERE name = 'Potato (Bag 2kg)';

-- Watermelon: Dole £23.00 ÷ 6 melons = 383p each
-- Was 525p — previous cost was causing a selling-below-cost situation
UPDATE products SET purchase_cost = 383 WHERE name = 'Watermelon';

-- Satsuma: Dole £18.00 ÷ 10kg = 180p/kg (up from 170p)
UPDATE products SET purchase_cost = 180 WHERE name = 'Satsuma';

-- Celery: Holland £9.60 ÷ 15 heads = 64p each (up from 60p)
UPDATE products SET purchase_cost = 64 WHERE name = 'Celery';

-- Cucumber: Holland £5.50 ÷ 14 (X14 box) = 39p each (down from 45p)
UPDATE products SET purchase_cost = 39 WHERE name = 'Cucumber';

-- Banana: Dole £18.50 ÷ 18kg = 103p/kg
-- (second delivery on same day: £19.00 ÷ 18kg = 106p/kg; minor fluctuation)
UPDATE products SET purchase_cost = 103 WHERE name = 'Banana';

-- Carrot Loose: Dole £5.50 ÷ 10kg = 55p/kg; unit corrected each → kg
UPDATE products SET purchase_cost = 55, unit = 'kg' WHERE name = 'Carrot Loose';

-- Onion Regular: Dole Chilean Size 1, £13.58 ÷ 20kg = 68p/kg
-- Previous cost 34p was calculated per-onion (wrong); corrected to per-kg
-- Unit corrected each → kg to match David's confirmed "by weight" selling method
UPDATE products SET purchase_cost = 68, unit = 'kg' WHERE name = 'Onion Regular';

-- ============================================================
-- CONFIRMED UNCHANGED (logged for audit trail)
-- Apple Royal Gala: £22.00 ÷ 12kg = 183p/kg ✓
-- Apple Pink Lady:  £7.50  ÷  4kg = 188p/kg ✓
-- Nectarine:        £7.00  ÷ 10 punnets = 70p ✓
-- Grapefruit:       £20.00 ÷ 35 = 57p each ✓
-- Mushroom Button:  £8.80  ÷ 12 punnets = 73p ✓
-- Potato Washed:    £7.00  ÷ 25kg = 28p/kg ✓
-- ============================================================
