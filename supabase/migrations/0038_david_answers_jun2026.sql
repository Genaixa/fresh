-- David's confirmed answers (8 Jun 2026): box weights, retail prices, unit corrections

-- ============================================================
-- PURCHASE COST CORRECTIONS
-- Several products had the whole-box price stored as per-unit
-- cost. Now corrected using confirmed box weights.
-- ============================================================

-- Red Pepper: 5 kg box, David sells by weight
-- £9.00 / 5 kg = 180p/kg
UPDATE products SET purchase_cost = 180, unit = 'kg' WHERE name = 'Pepper (Red)';

-- Yellow Pepper: 5 kg box, David sells by weight
-- £7.00 / 5 kg = 140p/kg
UPDATE products SET purchase_cost = 140, unit = 'kg' WHERE name = 'Pepper (Yellow)';

-- Courgette: 5 kg box, David sells by weight
-- £6.50 / 5 kg = 130p/kg
UPDATE products SET purchase_cost = 130, unit = 'kg' WHERE name = 'Courgette';

-- Aubergine: 5 kg box, David sells by weight
-- £5.50 / 5 kg = 110p/kg
UPDATE products SET purchase_cost = 110, unit = 'kg' WHERE name = 'Aubergine';

-- Tomato (regular round Dutch): 6 kg box
-- £4.00 / 6 kg = 67p/kg
-- Note: vine tomatoes are 5 kg box (£4.00 / 5 kg = 80p/kg); needs separate
-- "Tomato Vine" product if David stocks them separately in EPOS.
UPDATE products SET purchase_cost = 67, unit = 'kg' WHERE name = 'Tomato';

-- White Cabbage: sold as 10 kg bags ("small bags" = 10 kg net)
-- £5.50 / 10 kg = 55p/kg
-- Retail stays at 100p/kg (£1/kg confirmed by existing EPOS price)
UPDATE products SET purchase_cost = 55, unit = 'kg' WHERE name = 'Cabbage White';

-- Baker Potato (Potato Loose): confirmed sold loose by weight
-- Unit was 'each'; should be kg (price already £1.20/kg)
UPDATE products SET unit = 'kg' WHERE name = 'Potato Loose';

-- ============================================================
-- RETAIL PRICE ADDITIONS
-- Products that had no EPOS price set
-- ============================================================

-- Peas in the pod: sold by weight at £7/kg
-- (purchase_cost 450p/kg already correct from prior migration)
UPDATE products SET retail_price = 700, unit = 'kg' WHERE name = 'Pea';

-- Purple Potato 2 kg pre-packed bag: £1.40 (was £1.50)
UPDATE products SET retail_price = 140 WHERE name = 'Potato (Bag 2kg)';

-- Onion Prepacked (1 kg bags): same price as loose onion, £1.35/kg
-- Purchase cost: £5.20 for 10 × 1 kg bags = 52p/kg
UPDATE products SET retail_price = 135, purchase_cost = 52, unit = 'kg'
WHERE name = 'Onion Prepacked';

-- Grapes (Flame 500 g punnet): £2.20 per punnet
-- Grape Flame invoice lines map to this product; unit corrected bag → punnet
UPDATE products SET retail_price = 220, unit = 'punnet' WHERE name = 'Grapes';

-- ============================================================
-- NEW PRODUCT: Physalis
-- Not previously in catalogue; confirmed retail £1.69/punnet
-- Invoice cost £1.10/punnet (Physallis Punnets line)
-- ============================================================
INSERT INTO products (name, category, unit, retail_price, purchase_cost, is_active, case_size)
VALUES ('Physalis', 'fruit', 'punnet', 169, 110, true, 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPLIER MAPPING UPDATES
-- Fill confirmed box_weight_kg for Holland lines that had it null
-- ============================================================

-- Aubergines from Holland: 5 kg box (matches Total Produce mappings already set)
UPDATE supplier_product_mappings
SET unit_type = 'weight', box_weight_kg = 5
WHERE raw_description ILIKE '%aubergine%'
  AND (supplier_name ILIKE '%holland%' OR supplier_name ILIKE '%jrholland%')
  AND box_weight_kg IS NULL;

-- Courgettes from Holland: 5 kg box
UPDATE supplier_product_mappings
SET unit_type = 'weight', box_weight_kg = 5
WHERE raw_description ILIKE '%courgette%'
  AND (supplier_name ILIKE '%holland%' OR supplier_name ILIKE '%jrholland%')
  AND box_weight_kg IS NULL;

-- Red Peppers from Holland/Dole: 5 kg box
UPDATE supplier_product_mappings
SET unit_type = 'weight', box_weight_kg = 5
WHERE raw_description ILIKE '%red pepper%' OR raw_description ILIKE '%pepper%red%'
  AND box_weight_kg IS NULL;

-- ============================================================
-- NOT UPDATED
-- Passion Fruit: confirmed 1.5 kg box (Kenya); count fluctuates
--   so per-unit purchase cost cannot be calculated. Existing
--   purchase_cost of 34p stays until David can give a count.
-- Vine Tomato: 5 kg box at £4.00 → 80p/kg; no separate EPOS
--   product exists yet. Raise with David.
-- Baker Potato retail price: David said "per kg same as loose"
--   but did not confirm £/kg explicitly — Potato Loose at 120p
--   retained unless David says otherwise.
-- ============================================================
