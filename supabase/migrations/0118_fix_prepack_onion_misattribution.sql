-- 0118_fix_prepack_onion_misattribution.sql
-- "ONIONS - PP X10 X1 KILO" (a 10x1kg PREPACK) belongs to the "Onion Prepacked"
-- product, and the learned mapping correctly points there — but two early-June
-- invoice lines (8 & 9 Jun) were ingested before the mapping was corrected and got
-- stuck on "Onion Regular" (the loose 20kg sack). That stale £5.20 prepack price was
-- showing as Onion Regular's last Holland price on /market-run and triggering a bogus
-- "160% more than Holland" flag — comparing a loose sack against ready-bagged 1kg
-- packs. Re-point those lines to match the other (correct) prepack lines.
UPDATE purchase_invoice_items
SET product_id = (SELECT id FROM products WHERE name = 'Onion Prepacked')
WHERE product_name_raw ILIKE 'ONIONS - PP X10 X1 KILO'
  AND product_id = (SELECT id FROM products WHERE name = 'Onion Regular');
