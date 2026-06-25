-- 0116_epos_price_sync_25jun.sql
-- Retail price sync FROM EPOS Now (source of truth) — the 8 clean corrections from
-- the 25-Jun full export (epos_full_25jun.csv), reconciled via the same ID-first
-- matcher as /api/sync/import-prices. Large swings (unit mismatches) were HELD, and
-- the duplicate-button cases (Mango £1.00, Strawberry x4) are deliberately EXCLUDED
-- pending David deleting the stray buttons / confirming the strawberry price.
-- Prices in pence. record_price_change trigger logs each to price_history.
UPDATE products SET retail_price =  55 WHERE id = '9aaf97d9-8de5-4077-954d-e649f084c29b' AND retail_price =  45; -- Kiwi Loose      0.45->0.55
UPDATE products SET retail_price =  48 WHERE id = 'e2838162-83b6-41d9-85c2-d04f4f445967' AND retail_price =  40; -- Lemon           0.40->0.48
UPDATE products SET retail_price = 250 WHERE id = 'a65e48ce-4a87-4a52-936f-42ce26691dae' AND retail_price = 200; -- Melon Cantaloupe 2.00->2.50
UPDATE products SET retail_price = 199 WHERE id = 'b14acd54-6d55-4368-afb4-772a60542e84' AND retail_price = 100; -- Plums Punnet    1.00->1.99 (clears loss)
UPDATE products SET retail_price = 100 WHERE id = 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb' AND retail_price = 120; -- Tomato Cherry   1.20->1.00
UPDATE products SET retail_price = 450 WHERE id = '1c6cc1d4-7705-4692-8447-eeb815b9a4e1' AND retail_price = 400; -- Watermelon      4.00->4.50
UPDATE products SET retail_price = 600 WHERE id = 'c65565e5-cdec-447c-9197-87dd8ea0576d' AND retail_price = 550; -- Watermelon Large 5.50->6.00
UPDATE products SET retail_price = 229 WHERE id = 'df8d618e-d7da-4755-b47c-b89217b80d50' AND retail_price = 220; -- Grapes          2.20->2.29
