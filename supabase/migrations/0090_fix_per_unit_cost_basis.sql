-- ═══════════════════════════════════════════════════════════════════════════════
-- 0090 — Fix per-unit cost basis for per-fruit products (self-heal weighted costs)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Symptom (18 Jun): /pricing showed absurd "Wins" — Lychee £14.00, Kiwi £8.66,
--   Passion Fruit suggestions, etc. "Approve All" would have put nonsense on shelves.
--
-- Root cause: these products are SOLD per fruit (single 20p lychee, 39p passion,
--   55p kiwi) but their supplier lines were imported with unit_type='weight'
--   (description carries "2KG" / "3KG"). The product_weighted_costs view then
--   divides the BOX price by KILOGRAMS, producing a per-kg cost (£6.75/£7.50/£4.33)
--   instead of a per-fruit cost. The engine's ×2 markup explodes that into £14 etc.
--
--   This is the same class of bug fixed for Chinese Leaves / Mushroom Button in 0060.
--   Note: products.purchase_cost is already correct for these (18/39/37p) — only the
--   weighted-cost VIEW was contaminated, and the suggestion engine prefers the view.
--
-- Fix: retag the matched supplier lines as count-basis with the correct pack count
--   (the product's own case_size confirms the divisor), so the view self-heals to a
--   per-fruit cost that matches the blessed purchase_cost.
--
-- Not touched here (need David's unit decision — flagged separately, not guessed):
--   • Onion Red  — bag weight / sold per-kg vs per-onion unclear; lines left as-is,
--                  only the bad pending suggestion is cleared below.
--   • Garlic Loose — purchase_cost 0p + "GARLIC PP APOLLO X20" mapping is suspect
--                    (apollo peeled ≠ loose garlic?); cost left untouched.
--   • Avocado — RTE box (£1.25/unit) and loose Hass (per-kg) blended under one SKU.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Lychee: 2KG box, sold per single fruit; case_size = 90 fruit/box ───────────
UPDATE purchase_invoice_items it
SET unit_type = 'count', units_per_case = 90, box_weight_kg = NULL
FROM products p
WHERE it.product_id = p.id AND p.name = 'Lychee'
  AND it.is_matched AND it.unit_type = 'weight';

-- ── Passion Fruit: 2KG box, sold per fruit; case_size = 35 fruit/box ───────────
UPDATE purchase_invoice_items it
SET unit_type = 'count', units_per_case = 35, box_weight_kg = NULL
FROM products p
WHERE it.product_id = p.id AND p.name = 'Passion Fruit'
  AND it.is_matched AND it.unit_type = 'weight';

-- ── Kiwi Loose: "KIWI NZ 28 3KG" = 28 count box, sold per fruit ────────────────
UPDATE purchase_invoice_items it
SET unit_type = 'count', units_per_case = 28, box_weight_kg = NULL
FROM products p
WHERE it.product_id = p.id AND p.name = 'Kiwi Loose'
  AND it.is_matched AND it.unit_type = 'weight';

-- ── Clear the now-wrong / stale pending suggestions so today's list is clean ───
-- These were generated from the contaminated weighted cost (or a stale one, in
-- Parsnip's case). They regenerate correctly from the healed cost on the next
-- delivery for each product. Onion Red + Garlic Loose are cleared here too because
-- their current suggestions are wrong, pending David's unit decision.
DELETE FROM price_suggestions ps
USING products p
WHERE ps.product_id = p.id
  AND ps.status = 'pending'
  AND p.name IN ('Lychee', 'Passion Fruit', 'Kiwi Loose', 'Onion Red', 'Parsnip', 'Garlic Loose');
