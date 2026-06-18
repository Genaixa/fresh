-- ═══════════════════════════════════════════════════════════════════════════════
-- 0094 — Water: fix single price + add the 24-pack product (dual-format)
-- ═══════════════════════════════════════════════════════════════════════════════
-- David buys still water in 24×500ml cases (£3.00/case = 12.5p/bottle) and sells
-- BOTH as singles and as 24-packs. The case already maps to the single at count/24
-- (per-bottle cost). This adds the missing pack SKU and aligns the single's price.
--
--   Single  "Water Still 500ml"  : cost 12.5p, sell 25p  (EPOS) → 50% margin
--   24-pack "Water Bottles - 24"  : cost £3.00 (a case), sell £4.80 → 37.5% margin

-- 1. Single — shelf 50p → 25p to match the till. Reset multiplier 4.0 → 2.0 so the
--    pricing engine targets ~26p (not 52p) and stops suggesting to push it back up.
UPDATE products
SET retail_price = 25, price_multiplier = 2.00, updated_at = now()
WHERE name = 'Water Still 500ml';

-- 2. 24-pack — new product. Cost = one case (£3.00), shelf £4.80. case_size 1 (a
--    pack is one sale unit). multiplier 1.60 = 4.80/3.00 so suggestions match shelf.
--    No supplier mapping: the case line already costs the single, so this cost is
--    maintained directly (case price has been a stable £3.00 for weeks).
INSERT INTO products (name, category, unit, case_size, purchase_cost, retail_price, price_multiplier, margin_floor, is_active)
VALUES ('Water Bottles - 24', 'other', 'each', 1, 300, 480, 1.60, 0.20, true)
ON CONFLICT DO NOTHING;
