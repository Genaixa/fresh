-- 0129: clean up the duplicate "Red Onion" product (7d110371…) by merging it into the
-- canonical "Onion Red" (6f859222…, the EPOS-linked one, epos 4590131).
-- "Red Onion" was already is_active=false and had NO mappings/invoices/sales/aliases, but it
-- still held 8 wholesale_order_items (all 2026-06-03 seed/demo orders) + 2 price_history rows,
-- so a raw DELETE would hit those FKs. Re-point them to Onion Red first, then delete.
-- (Verified: those were the ONLY two of the 17 product-FK tables referencing it.)

update wholesale_order_items set product_id='6f859222-21e6-4a42-b7a6-ab42e914d07a'
where product_id='7d110371-2fba-4342-ab57-f56408c98e71';

update price_history set product_id='6f859222-21e6-4a42-b7a6-ab42e914d07a'
where product_id='7d110371-2fba-4342-ab57-f56408c98e71';

delete from products where id='7d110371-2fba-4342-ab57-f56408c98e71';
