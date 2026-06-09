-- ─────────────────────────────────────────────────────────────────────────────
-- 0063 David's answers, 9 Jun 2026
--
-- Pointy Pepper: only bought once from JR, doesn't sell — deactivate Sweet Pepper
-- Satsuma: sold loose as "Tangerine" at £3.33/kg; 10kg box → case_size=10, retail=333p
-- Vine Tomato: confirmed goes through EPOS as plain "Tomato" — no separate product
-- Apple Granny Smith: Jun 8 invoice shows £18 correctly — no action needed
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Sweet Pepper (Pointy Pepper) — stopped buying, doesn't sell ──────────────
UPDATE products SET is_active = false WHERE name = 'Sweet Pepper';

-- ── Satsuma → Tangerine, sold loose by weight at £3.33/kg ────────────────────
-- Deactivate the empty "Tangerine" placeholder first
UPDATE products SET is_active = false WHERE name = 'Tangerine' AND purchase_cost = 0 AND retail_price = 0;

-- Rename Satsuma and set correct pricing + case_size
UPDATE products
SET name         = 'Tangerine',
    retail_price = 333,
    case_size    = 10     -- 10kg box; view divides invoice cost by 10 to get cost/kg
WHERE name = 'Satsuma';

-- Update supplier mappings to carry case size through to invoice items
UPDATE supplier_product_mappings
SET units_per_case = 10
WHERE product_id = (SELECT id FROM products WHERE name = 'Tangerine' AND purchase_cost = 90)
  AND units_per_case IS NULL;

-- ── Clean up stale price suggestions ─────────────────────────────────────────
DELETE FROM price_suggestions
WHERE status = 'pending'
  AND product_id IN (
    SELECT id FROM products WHERE name IN ('Sweet Pepper', 'Tangerine', 'Satsuma')
  );
