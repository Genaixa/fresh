-- Holland (3 tickets) + Dole #11223912 + Dole #11223946 — 08/06/2026
-- Assumptions noted where box count is inferred, not stated.

-- ============================================================
-- HOLLAND INVOICE 1 (Devorah Grynavs)
-- ============================================================

-- Beetroot - Nets: assumed standard 10 kg net → £6.00/10 kg = 60p/kg
-- Unit corrected each→kg (sold loose by weight)
UPDATE products SET purchase_cost = 60, unit = 'kg' WHERE name = 'Beetroot';

-- White Cabbage: 25 kg Dutch box → £7.80/25 kg = 31p/kg (down from 55p/10 kg bag)
UPDATE products SET purchase_cost = 31 WHERE name = 'Cabbage White';

-- Carrots: Chinese 10 kg box → £8.00/10 kg = 80p/kg (up from Spain 55p)
UPDATE products SET purchase_cost = 80 WHERE name = 'Carrot Loose';

-- Onion Regular (Chilean Size 1): 20 kg box → £12.00/20 kg = 60p/kg (down from 68p)
UPDATE products SET purchase_cost = 60 WHERE name = 'Onion Regular';

-- Onion Spanish (Dutch Onion 24 kg): 24 kg box → £8.20/24 kg = 34p/kg (first cost data)
UPDATE products SET purchase_cost = 34, unit = 'kg' WHERE name = 'Onion Spanish';

-- Onion Red (Legend variety): assumed 10 kg box → £4.30/10 kg = 43p/kg
-- Unit corrected each→kg
UPDATE products SET purchase_cost = 43, unit = 'kg' WHERE name = 'Onion Red';
UPDATE products SET purchase_cost = 43, unit = 'kg' WHERE name = 'Red Onion';

-- Parsnip (Spanish): assumed 10 kg box → £10.00/10 kg = 100p/kg
-- Unit corrected each→kg (sold by weight)
UPDATE products SET purchase_cost = 100, unit = 'kg' WHERE name = 'Parsnip';

-- ============================================================
-- HOLLAND INVOICE 2 (Mids)
-- ============================================================

-- Potato Mids PP 9×2.5 kg: £25.00 ÷ (9 × 2.5 kg) = 111p/kg (up from 75p)
UPDATE products SET purchase_cost = 111 WHERE name = 'Potato Mids';

-- ============================================================
-- HOLLAND INVOICE 3 (Devorah Grynavs)
-- ============================================================

-- Bean Fine punnets: £0.95 each → 95p/punnet
UPDATE products SET purchase_cost = 95, unit = 'punnet' WHERE name = 'Bean Fine';

-- Garlic Peeled Apollo bags: £2.70/bag → 270p/bag (1 kg peeled garlic bag)
UPDATE products SET purchase_cost = 270 WHERE name = 'Garlic Peeled Pack';

-- Garlic P/P Apollo x20: £16.00 ÷ 20 pre-packs = 80p/pre-pack (3-bulb net)
UPDATE products SET purchase_cost = 80 WHERE name = 'Garlic Prepack';

-- Kohlrabi box: assumed 10 per box → £17.50/10 = 175p each
UPDATE products SET purchase_cost = 175 WHERE name = 'Kohlrabi';

-- Sugar Snap Peas punnets: £1.15 each → 115p/punnet
UPDATE products SET purchase_cost = 115, unit = 'punnet' WHERE name = 'Sugarsnap';

-- Sweet Potato Future Farms L1: assumed 6 large per box → £8.00/6 = 133p each
UPDATE products SET purchase_cost = 133 WHERE name = 'Sweet Potato';

-- Avocado RTE: assumed 24-pack → £15.00/24 = 63p each (up from 36p)
UPDATE products SET purchase_cost = 63 WHERE name = 'Avocado';

-- Passion Fruit Black Box £13.50: existing 34p/each ✓ (~40 per box = 37g each).
-- This CONFIRMS the count is approximately 40. No cost change needed.
-- Physalis punnets £1.10: cost = 110p ✓ confirmed. No change.

-- ============================================================
-- DOLE INVOICE #11223912 (Nicholas Bamling)
-- ============================================================

-- Potato 2 kg bag (Thickpenny 10×2 kg): £6.50/10 = 65p/bag (down from 85p)
UPDATE products SET purchase_cost = 65 WHERE name = 'Potato (Bag 2kg)';

-- Nectarine 10×500 g: £6.00/10 = 60p/punnet (down from 70p — season price drop)
UPDATE products SET purchase_cost = 60 WHERE name = 'Nectarine';

-- Peach 24 5 kg: £9.50/24 = 40p each (up from 35p)
UPDATE products SET purchase_cost = 40 WHERE name = 'Peach';

-- Blueberry 12×125 g: £12.00/12 = 100p/punnet
UPDATE products SET purchase_cost = 100 WHERE name = 'Blueberry';

-- Pomegranate Peru 9 5 kg: £9.50/9 = 106p each (up from 87p)
UPDATE products SET purchase_cost = 106 WHERE name = 'Pomegranate';

-- Satsuma ZA 10 kg: £9.00/10 kg = 90p/kg (DOWN from 180p Spain — ZA in season)
UPDATE products SET purchase_cost = 90 WHERE name = 'Satsuma';

-- Pineapple Costa Rica 8 10 kg: £13.50/8 = 169p each (down from 175p)
UPDATE products SET purchase_cost = 169 WHERE name = 'Pineapple';

-- Watermelon Spain 6 16 kg: £21.00/6 = 350p each (down from Brazil £23/6 = 383p)
UPDATE products SET purchase_cost = 350 WHERE name = 'Watermelon';

-- Melon Galia Spain 8 14 kg: £15.00/8 = 188p each
UPDATE products SET purchase_cost = 188 WHERE name = 'Melon Galia';

-- Melon Cantaloupe Spain 8 12 kg: £16.00/8 = 200p each
-- ⚠️ COST = RETAIL (200p). Zero margin. Flag to David — price must rise to at least £2.50.
UPDATE products SET purchase_cost = 200 WHERE name = 'Melon Cantaloupe';

-- Melon Honeydew Spain 10 13 kg: £14.50/10 = 145p each (down from 150p)
UPDATE products SET purchase_cost = 145 WHERE name = 'Melon Honeydew';

-- Lemon South Africa 75 15 kg: £28.00/75 = 37p each (up from 25p)
-- ⚠️ Retail is only 40p → 7.5% margin. Flag to David — needs to be at least 47p.
UPDATE products SET purchase_cost = 37 WHERE name = 'Lemon';

-- Kiwi Italy 30 5 kg: £11.00/30 = 37p each (down from 48p — was selling at a loss!)
-- Margin now 17.8%: still below 20% floor but at least profitable.
UPDATE products SET purchase_cost = 37 WHERE name = 'Kiwi Loose';

-- Grape Flame 10×500 g: £18.00/10 = 180p/punnet (down from 190p)
UPDATE products SET purchase_cost = 180 WHERE name = 'Grapes';

-- Banana CR 18 kg: £18.50/18 = 103p/kg ✓ confirmed. No change.
-- Apple Pink Lady FR 4 kg: £7.50/4 = 188p/kg ✓ confirmed. No change.
-- Apple Royal Gala Chile 12 kg: £22.00/12 = 183p/kg ✓ confirmed. No change.
-- Apple Braeburn France 12 kg: £18.00/12 = 150p/kg ✓ confirmed. No change.
-- Apple Granny Smith France 13 kg: £1.00 — anomaly/clearance price, NOT updating cost.

-- ============================================================
-- DOLE INVOICE #11223946 (Stephen Bainbridge)
-- ============================================================

-- Capsicum Mixed NL 10×500 g: £14.00/10 = 140p/pack (first cost data for mixed pepper)
UPDATE products SET purchase_cost = 140 WHERE name = 'Pepper (Mixed)';

-- Capsicum Yellow NL 5 kg: £7.50/5 kg = 150p/kg (up from 140p)
UPDATE products SET purchase_cost = 150 WHERE name = 'Pepper (Yellow)';

-- Aubergine NL 5 kg: £6.50/5 kg = 130p/kg (up from 96p — Jun 5 Holland was unusually cheap)
UPDATE products SET purchase_cost = 130 WHERE name = 'Aubergine';
