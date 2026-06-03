-- 0034: Ness — July–September 2025 order history (additional to 0028 which covers Nov 2025–Mar 2026)
-- Customer already exists: cid = 11111111-1111-1111-1111-000000000004
-- Total: £225.50 across 4 deliveries (11 Jul – 01 Sep 2025)
-- "red skin pot" → Potato (Soraya): Ness's established potato product; summer price £16.50 vs winter £12
-- "mixed pepper" → Red Pepper: too generic to map specifically (see question 29)
-- Summer onion price (£26/sack) and cabbage (£14) higher than winter — seasonal

INSERT INTO wholesale_customers (id, name, email, contact_name, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000004', 'Ness', 'EFYSERFATY@gmail.com', 'Ephraim Serfaty', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Ness', email = 'EFYSERFATY@gmail.com', contact_name = 'Ephraim Serfaty';

DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000004';
  oid         uuid;
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_parsnip   uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_celeriac  uuid := 'd19e1db9-6c21-42c2-bbb2-f72d3a595d07';
  p_swede     uuid := '28ff7b46-5d20-4beb-9bd0-997eeb750500';
  p_sweetpot  uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_butternut uuid := '31b54cad-4d38-4cb1-b9d6-091deacd53b3';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_mushroom  uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_cabwhite  uuid := '5c925564-a9c0-4a84-badc-b44ec82c2c4b';
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_soraya    uuid;
BEGIN
  SELECT id INTO p_soraya FROM products WHERE name = 'Potato (Soraya)' LIMIT 1;

  -- 11/07/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-07-11', '2025-07-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,  3, 2600, 'box'),
    (oid, p_soraya, 2, 1650, 'retail_unit');  -- red skin pot

  -- 27/08/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-08-27', '2025-08-27', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_parsnip,  1,  950, 'box'),
    (oid, p_celeriac, 1,  940, 'box'),
    (oid, p_swede,    1,  650, 'box'),
    (oid, p_sweetpot, 1, 1100, 'box'),
    (oid, p_rpep,     1, 1100, 'box'),   -- mixed pepper → Red Pepper
    (oid, p_butternut,1, 1300, 'box'),
    (oid, p_courgette,1,  900, 'box');

  -- 28/08/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-08-28', '2025-08-28', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 3, 770, 'box');

  -- 01/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-01', '2025-09-01', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cabwhite, 1, 1400, 'box'),
    (oid, p_carrot,   1,  800, 'box');

END $$;
