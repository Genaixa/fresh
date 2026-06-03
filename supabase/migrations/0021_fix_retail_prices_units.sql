-- Fix retail_price and purchase_cost unit mismatches
-- All values now on consistent basis:
--   weight items (no retailUnitsPerBox in config) → pence per kg
--   count/per-piece items                         → pence per item

-- ── retail_price fixes ────────────────────────────────────────────────────────

-- Carrot Loose: was 25p (wrong), EPOS "Carrot Bag 1KG £1.00" = 100p/kg
UPDATE products SET retail_price = 100 WHERE name = 'Carrot Loose';

-- Onion Regular: was 30p (old data), EPOS "Onions £1.35" = 135p/kg
UPDATE products SET retail_price = 135 WHERE name = 'Onion Regular';

-- Parsnip: was 299p (typo in migration 0017), EPOS "Parsnip £2.80" = 280p/kg
UPDATE products SET retail_price = 280 WHERE name = 'Parsnip';

-- Pepper (Red): migration 0017 failed to update, EPOS "Peppers Red £4.49" = 449p each
UPDATE products SET retail_price = 449 WHERE name = 'Pepper (Red)';

-- Pepper (Yellow): same
UPDATE products SET retail_price = 449 WHERE name = 'Pepper (Yellow)';

-- Aubergine: was 380p per aubergine (wrong — sold per kg), EPOS "Aubergine £3.80" = 380p/kg ✓ value correct, unit now consistent
-- (retailUnitsPerBox removed from config.ts so this is now treated as per-kg)

-- Courgette: was 380p per courgette (wrong — sold per kg), 380p/kg ✓ value correct
-- (retailUnitsPerBox removed from config.ts)

-- Tomato: was 480p per tomato (wrong — sold per kg), 480p/kg ✓ value correct
-- (retailUnitsPerBox removed from config.ts)

-- Satsuma: was 330p per fruit (wrong — sold per kg), 330p/kg ✓ value correct
-- (retailUnitsPerBox removed from config.ts)

-- ── purchase_cost fixes ───────────────────────────────────────────────────────
-- purchase_cost must match the unit calcPricing uses for costPerUnit

-- Passion Fruit: was 675 (per-kg), config has retailUnitsPerBox=40 so calcPricing
-- uses per-fruit. At latest price £13.50/2kg box: 1350p / 40 = 33.75p → 34p per fruit
UPDATE products SET purchase_cost = 34  WHERE name = 'Passion Fruit';

-- Watermelon: was 525 (from overpriced 4s buy). Normal 9s box £21 = 233p each
UPDATE products SET purchase_cost = 233 WHERE name = 'Watermelon';

-- Aubergine: was 680 (looks like a per-box price wrongly stored). Now per-kg.
-- Recent Holland price ~140p/kg (max is 140p/kg). Set to 0 until next invoice updates it.
UPDATE products SET purchase_cost = 0   WHERE name = 'Aubergine';

-- Courgette: was 750 (per-box price wrongly stored). Now per-kg. Clear until next invoice.
UPDATE products SET purchase_cost = 0   WHERE name = 'Courgette';

-- Pepper (Red): was 780 (per-box wrongly stored). Now per-pepper.
-- Typical 5kg box ~30 peppers. Recent Dole price ~£12/box: 1200/30 = 40p each.
UPDATE products SET purchase_cost = 40  WHERE name = 'Pepper (Red)';

-- Pepper (Yellow): similar
UPDATE products SET purchase_cost = 40  WHERE name = 'Pepper (Yellow)';

-- Tomato Cherry Vine: was 700 (per-punnet price matches retail 699p — almost 0 margin).
-- This is the cost per punnet from recent invoice. Tomato Cherry Vine 9 punnets at £7/box → 78p each.
-- But wait: 700p cost vs 699p retail means he's buying at retail price. Needs checking.
-- For now set to match a sensible recent purchase: Holland tomato cherry vine ~£7/9 = 78p/punnet
UPDATE products SET purchase_cost = 78  WHERE name = 'Tomato Cherry Vine';
