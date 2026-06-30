-- 0130: two more "like the onions" cleanups found by the catalogue scan.

-- A) Duplicate "Tangerine" products. Canonical = 3d4f1023 (active, EPOS-linked 4580444, has
--    sales). Shadow = 3e03f4e8 (inactive, no EPOS) accumulated 94 invoice lines + 41 supplier
--    mappings + 14 wholesale orders + 20 seasonal-avg rows. Verified the 41 mappings share NO
--    (supplier, normalised_description) with the canonical, so re-pointing is collision-free.
update supplier_product_mappings set product_id='3d4f1023-ca6a-413c-8018-384a605c4c42', updated_at=now()
where product_id='3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
update purchase_invoice_items set product_id='3d4f1023-ca6a-413c-8018-384a605c4c42'
where product_id='3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
update wholesale_order_items set product_id='3d4f1023-ca6a-413c-8018-384a605c4c42'
where product_id='3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
-- seasonal averages are derived aggregates (recompute from sales/invoices) → drop the shadow's
-- to avoid a (product_id, period) collision with the canonical's own rows.
delete from product_seasonal_averages where product_id='3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
delete from products where id='3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';

-- B) "PEAS - PLASTIC BOX" was mapped to Bean Fine (fine beans) — but it's PEAS, and its sibling
--    "PEAS - WOOD" correctly maps to Pea. Re-file to Pea.
update supplier_product_mappings set product_id='38369a6b-442d-4a9f-aba5-099ad5d0370e', updated_at=now()
where raw_description='PEAS - PLASTIC BOX';
update purchase_invoice_items set product_id='38369a6b-442d-4a9f-aba5-099ad5d0370e'
where product_name_raw='PEAS - PLASTIC BOX';
