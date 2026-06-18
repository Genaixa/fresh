-- ═══════════════════════════════════════════════════════════════════════════════
-- 0091 — Fix per-case cost basis for Carrot Loose & Potato Washed (sequel to 0090)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Both showed withheld suggestions on /pricing (Carrot £14.88, Potato £13.20)
-- because a whole SACK price was read as per-unit: the supplier lines were tagged
-- unit_type='count', units_per_case=1, so product_weighted_costs divided the sack
-- price by 1 instead of by the kilos in the sack.
--
-- The correct sack sizes are not a guess — they're the established, confirmed
-- supplier mappings for these exact products:
--   • Washed potato sacks = 25KG  (Baty "WASHED POTATO"→weight/25, "POTATO WASHED UK 25KG"…)
--   • Carrot bags         = 10KG  (dozens of weight/10kg mappings incl. JR Holland
--                                   "CARROTS - CHINESE"; only French/Spanish/Clear-bag
--                                   slipped through as count/1).
--
-- Fix: retag the contaminating lines to weight-basis so the view self-heals, fix
-- the bad supplier mappings so future lines map correctly, correct Carrot Loose's
-- stale purchase_cost, and clear the now-wrong withheld suggestions.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Potato Washed: WASHED POTATO is a 25KG Baty sack ──────────────────────────
UPDATE purchase_invoice_items it
SET unit_type = 'weight', box_weight_kg = 25, units_per_case = NULL
FROM products p
WHERE it.product_id = p.id AND p.name = 'Potato Washed'
  AND it.is_matched AND it.unit_type = 'count' AND COALESCE(it.units_per_case,1) = 1;

UPDATE supplier_product_mappings
SET unit_type = 'weight', box_weight_kg = 25, units_per_case = NULL
WHERE raw_description = 'WASHED POTATO' AND unit_type = 'count';

-- ── Carrot Loose: French / Spanish / Clear-bag are 10KG bags ──────────────────
UPDATE purchase_invoice_items it
SET unit_type = 'weight', box_weight_kg = 10, units_per_case = NULL
FROM products p
WHERE it.product_id = p.id AND p.name = 'Carrot Loose'
  AND it.is_matched AND it.unit_type = 'count' AND COALESCE(it.units_per_case,1) = 1
  AND it.product_name_raw IN ('CARROTS - FRENCH', 'CARROTS - SPANISH', 'CARROTS - CLEAR BAG LARGE');

UPDATE supplier_product_mappings
SET unit_type = 'weight', box_weight_kg = 10, units_per_case = NULL
WHERE raw_description IN ('CARROTS - FRENCH', 'CARROTS - SPANISH', 'CARROTS - CLEAR BAG LARGE')
  AND unit_type = 'count';

-- ── Correct Carrot Loose's stale per-unit cost to the healed weighted cost ─────
-- (Potato Washed's stored cost is already 26p, which the healed view matches.)
UPDATE products p
SET purchase_cost = wc.weighted_unit_cost_pence
FROM product_weighted_costs wc
WHERE wc.product_id = p.id AND p.name = 'Carrot Loose'
  AND wc.weighted_unit_cost_pence IS NOT NULL
  AND wc.weighted_unit_cost_pence < p.retail_price;   -- never set cost above shelf

-- ── Clear the now-wrong withheld/pending suggestions (regenerate on next delivery) ─
DELETE FROM price_suggestions ps
USING products p
WHERE ps.product_id = p.id
  AND ps.status IN ('withheld', 'pending')
  AND p.name IN ('Carrot Loose', 'Potato Washed');
