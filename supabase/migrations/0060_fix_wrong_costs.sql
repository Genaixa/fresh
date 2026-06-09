-- Fix costs broken by invoice pipeline storing per-case prices as per-unit costs.
--
-- Root cause: product_weighted_costs view uses COALESCE(units_per_case, 1).
-- When invoice items land with units_per_case = NULL or 1, per-CASE price
-- is treated as per-UNIT price, giving wildly wrong weighted averages.
--
-- Fix 1: Correct units_per_case in invoice items so the view self-heals.
-- Fix 2: Directly set purchase_cost so it's right immediately.
-- Fix 3: Deactivate Pepper (Orange) — cost 300p vs retail 50p is nonsensical,
--         never sells (weekly_units null), needs David to clarify what it is.

-- ── Chinese Leaves ────────────────────────────────────────────────────────────
-- Box of 10 leaves; unit_cost in invoice items is the per-BOX price.
-- Any line with unit_cost >= 400 is a box price, not per-leaf.
UPDATE purchase_invoice_items
SET units_per_case = 10
WHERE product_id = (SELECT id FROM products WHERE name = 'Chinese Leaves')
  AND unit_cost >= 400;

-- Also fix case_size on the product itself
UPDATE products SET case_size = 10 WHERE name = 'Chinese Leaves';

-- Set correct per-leaf cost (latest box price £8.80 ÷ 10)
UPDATE products SET purchase_cost = 88 WHERE name = 'Chinese Leaves';

-- ── Mushroom Button ───────────────────────────────────────────────────────────
-- Tray of 12 punnets (250g each); unit_cost in invoice items is the per-TRAY price.
-- Any line with unit_cost >= 400 is a tray price.
UPDATE purchase_invoice_items
SET units_per_case = 12
WHERE product_id = (SELECT id FROM products WHERE name = 'Mushroom Button')
  AND unit_cost >= 400
  AND (units_per_case IS NULL OR units_per_case < 2);

-- Set correct per-punnet cost (latest tray price £5.50 ÷ 12 = 45.8p → 46p)
UPDATE products SET purchase_cost = 46 WHERE name = 'Mushroom Button';

-- ── Pepper (Orange) ───────────────────────────────────────────────────────────
-- cost=300p, retail=50p, never sells — deactivate until David confirms what it is
UPDATE products SET is_active = false WHERE name = 'Pepper (Orange)';

-- ── Clear stale suggestions ───────────────────────────────────────────────────
-- Remove any pending/on_hold suggestions generated from the wrong costs above.
DELETE FROM price_suggestions
WHERE status IN ('pending', 'on_hold')
  AND product_id IN (
    SELECT id FROM products WHERE name IN ('Chinese Leaves', 'Mushroom Button', 'Pepper (Orange)')
  );

-- ── Mushroom Button unit_type fix ─────────────────────────────────────────────
-- Total Produce invoice items were stored as unit_type='weight' with box_weight_kg=2.27.
-- The weighted-cost view uses box_weight_kg as the divisor when unit_type='weight',
-- giving 74p/kg instead of the correct 550÷12=46p per punnet.
-- Mushrooms are sold as individual punnets (count), not by weight.
UPDATE purchase_invoice_items
SET unit_type = 'count'
WHERE product_id = (SELECT id FROM products WHERE name = 'Mushroom Button')
  AND unit_type = 'weight';
