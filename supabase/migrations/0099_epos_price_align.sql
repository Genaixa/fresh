-- 0099: Align catalogue retail prices to the till (EPOS) where the product is
-- unambiguously the same item. EPOS is the source of truth for shop prices.
-- Only the confidence-1.00, exact-name, same-unit matches are applied here; the
-- variant/promo/different-SKU rows from the reconciliation are deliberately left
-- for a manual mapping decision (applying EPOS to those would corrupt prices).
-- Guarded by the current value so it's idempotent and a no-op if already changed.

BEGIN;

UPDATE products SET retail_price = 100 WHERE name = 'Mango'             AND retail_price = 150 AND is_active;
UPDATE products SET retail_price =  39 WHERE name = 'Passion Fruit'     AND retail_price =  50 AND is_active;
UPDATE products SET retail_price = 400 WHERE name = 'Watermelon Small'  AND retail_price = 450 AND is_active;
UPDATE products SET retail_price = 160 WHERE name = 'Strawberry Punnet' AND retail_price = 180 AND is_active;
UPDATE products SET retail_price = 250 WHERE name = 'Strawberry'        AND retail_price = 360 AND is_active;

COMMIT;
