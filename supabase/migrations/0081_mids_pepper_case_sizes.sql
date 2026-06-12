-- MIDS - PP 9X2.5KG = a box of 9 × 2.5kg prepack bags (David confirmed mids =
-- baby potatoes). The mapping saved via the review screen had no case size, so
-- the £25 box price was read as per-unit → bogus £50 price suggestion (withheld
-- by the plausibility guard). Teach the mapping + fix ingested lines + cost.
UPDATE supplier_product_mappings SET units_per_case=9, unit_type='count'
WHERE raw_description ILIKE '%MIDS - PP 9X2.5KG%';

UPDATE purchase_invoice_items SET units_per_case=9
WHERE product_name_raw ILIKE '%MIDS - PP 9X2.5KG%';

-- Potato Baby latest real cost: £25 box ÷ 9 bags = £2.78/bag
UPDATE products SET purchase_cost=278 WHERE name='Potato Baby';

-- Mixed peppers "X10" tri-colour: same per-case-read-as-per-unit bug
UPDATE supplier_product_mappings SET units_per_case=10, unit_type='count'
WHERE raw_description ILIKE '%MIXED PEPPERS%X10%' AND (units_per_case IS NULL OR units_per_case<=1);

UPDATE purchase_invoice_items SET units_per_case=10
WHERE product_name_raw ILIKE '%MIXED PEPPERS%X10%' AND (units_per_case IS NULL OR units_per_case<=1);
