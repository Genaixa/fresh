-- 0103_session_data_fixes_24jun.sql
-- Documentary capture of data corrections applied as raw SQL during the
-- 24 Jun catalogue/costing session, so a DB rebuilt from migrations matches
-- the live DB. All statements are idempotent (re-running sets the same value).
-- Mirrors the convention of 0100_epos_id_fixes.sql.

-- 1. Cost / supplier corrections ------------------------------------------------
-- Milk: invoice #20019 (The Milk Company) was ingested but cost never propagated
-- to the product because the supplier was created in `suppliers` not
-- `purchase_suppliers` (the FK target). See 0104 for the table reconciliation.
UPDATE products
SET purchase_cost = 129,
    default_supplier_id = 'aaaaaaaa-0004-0000-0000-000000000004'  -- The Milk Company (purchase_suppliers)
WHERE name = 'Milk';

-- Potato (Soraya): DB held 51p; Baty invoices it ("Washed Soraya") at 26.4p/kg.
UPDATE products SET purchase_cost = 27 WHERE name = 'Potato (Soraya)';

-- Carrot Bag 1KG = 1kg of Carrot Loose (70p/kg).
UPDATE products SET purchase_cost = 70 WHERE name = 'Carrot Bag 1KG';

-- 2. EPOS button links from David's till export ---------------------------------
-- New links (products that had a button all along) + interpretive matches.
UPDATE products SET epos_now_id = '20296294' WHERE name = 'Apricot Punnet';
UPDATE products SET epos_now_id = '10285274' WHERE name = 'Fig';
UPDATE products SET epos_now_id = '7821220'  WHERE name = 'Marrow';
UPDATE products SET epos_now_id = '50246432' WHERE name = 'Water Bottles - 24';
UPDATE products SET epos_now_id = '19761751' WHERE name = 'Lettuce Little Gem';
UPDATE products SET epos_now_id = '10054732' WHERE name = 'Cherry';              -- Cherries loose
UPDATE products SET epos_now_id = '39091840' WHERE name = 'Granadilla';          -- Grandilo
UPDATE products SET epos_now_id = '45598704' WHERE name = 'Chilli (Red)';        -- Red/Green chili peppers
UPDATE products SET epos_now_id = '46984385' WHERE name = 'Sharon Fruit Punnet'; -- Sharon punnet

-- Re-links: these pointed at button ids that no longer exist in the till.
UPDATE products SET epos_now_id = '4580430'  WHERE name = 'Papaya';         -- was dead 47744198
UPDATE products SET epos_now_id = '50500343' WHERE name = 'Horseradish';    -- was dead 9620292 -> Horseradish wrapped
UPDATE products SET epos_now_id = '52183545' WHERE name = 'Chinese Leaves'; -- was dead 7927245 -> chinese leaf

-- 3. Sales attribution backfill -------------------------------------------------
-- Re-attribute sales lines whose epos id matches a product but product_id was null.
UPDATE sales_data s
SET product_id = p.id
FROM products p
WHERE p.epos_now_id = s.epos_product_id
  AND s.product_id IS NULL;
