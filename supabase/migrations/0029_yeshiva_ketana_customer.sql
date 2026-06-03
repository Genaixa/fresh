-- 0029: Yeshiva Ketana wholesale customer + February 2026 order history
-- Email: yltyuk@yahoo.co.uk (Yeshiva LeZeirim)
-- Total: £925.34 across 9 deliveries (09 Feb – 26 Feb 2026)
-- Note: 24/02 order contains EPOS-style items (leeks £5.13, Braeburn apple £0.41)
-- Note: 10/02 and 17/02 each have two separate delivery groups

INSERT INTO wholesale_customers (id, name, email, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000005', 'Yeshiva Ketana', 'yltyuk@yahoo.co.uk', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Yeshiva Ketana', email = 'yltyuk@yahoo.co.uk';

DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000005';
  oid         uuid;
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_potato    uuid := '32818a27-e07f-43d9-a957-2a90aac27181';
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_cherry    uuid := 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb';
  p_auberg    uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_tomato    uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_cucumber  uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_ypep      uuid := '298c882e-26db-4c5c-bc08-40035214a9e1';
  p_tangerine uuid := '3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
  p_garlic    uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_mushroom  uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_grapes    uuid := 'df8d618e-d7da-4755-b47c-b89217b80d50';
  p_pineapple uuid := 'e29d7739-a29f-48bd-bc07-3d6e7794f828';
  p_potmids   uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_leek      uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_potbaker  uuid;
  p_pear      uuid;
  p_apple_br  uuid;
BEGIN
  SELECT id INTO p_potbaker FROM products WHERE name = 'Potato Sack'    LIMIT 1;
  SELECT id INTO p_pear     FROM products WHERE name = 'Pear Conference' LIMIT 1;
  SELECT id INTO p_apple_br FROM products WHERE name = 'Apple Braeburn'  LIMIT 1;

  -- 09/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-09', '2026-02-09', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot,    1,  770, 'box'),
    (oid, p_potato,    2, 1300, 'box'),
    (oid, p_onion,     1, 1750, 'box'),
    (oid, p_cherry,    1, 1400, 'box'),
    (oid, p_auberg,    1, 1800, 'box'),
    (oid, p_courgette, 1, 1800, 'box');

  -- 10/02/2026 — delivery A: salad, fruit, garlic + loose carrots (misc)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-10', '2026-02-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tomato,    2, 1460, 'box'),
    (oid, p_cucumber,  2, 1400, 'box'),
    (oid, p_rpep,      2, 2000, 'box'),
    (oid, p_ypep,      1, 2200, 'box'),
    (oid, p_tangerine, 2, 2200, 'box'),
    (oid, p_pear,      1, 2300, 'box'),
    (oid, p_garlic,    2,  600, 'retail_unit'),
    (oid, p_carrot,    1,  350, 'retail_unit');

  -- 10/02/2026 — delivery B: staples + grapes + jacket potatoes
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-10', '2026-02-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    3, 1300, 'box'),
    (oid, p_onion,     2, 1750, 'box'),
    (oid, p_cucumber,  2, 1400, 'box'),
    (oid, p_mushroom,  2,  770, 'box'),
    (oid, p_grapes,    1, 2000, 'box'),
    (oid, p_pineapple, 1, 1400, 'box'),
    (oid, p_potbaker,  3, 1100, 'box');

  -- 17/02/2026 — delivery A: onions, baby potatoes, tomatoes + yellow pepper
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-17', '2026-02-17', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,  2, 1750, 'box'),
    (oid, p_potmids, 3, 1100, 'box'),
    (oid, p_tomato,  1, 1200, 'box'),
    (oid, p_cherry,  2, 1200, 'box'),
    (oid, p_ypep,    1, 1400, 'box');

  -- 17/02/2026 — delivery B: mushrooms, pears, carrots
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-17', '2026-02-17', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 2,  770, 'box'),
    (oid, p_pear,     1, 2300, 'box'),
    (oid, p_carrot,   1,  760, 'box');

  -- 22/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-22', '2026-02-22', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    2, 1300, 'box'),
    (oid, p_tangerine, 1, 2300, 'box'),
    (oid, p_rpep,      1, 1700, 'box'),
    (oid, p_onion,     2, 1750, 'box');

  -- 24/02/2026 — EPOS-style small items (loose leeks + single apple)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-24', '2026-02-24', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_leek,     1, 513, 'retail_unit'),
    (oid, p_apple_br, 1,  41, 'retail_unit');

  -- 26/02/2026 — delivery A: main
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-26', '2026-02-26', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    3, 1300, 'box'),
    (oid, p_tangerine, 1, 2000, 'box'),
    (oid, p_rpep,      1, 1800, 'box'),
    (oid, p_ypep,      1, 1800, 'box'),
    (oid, p_onion,     1, 1750, 'box'),
    (oid, p_grapes,    1, 2000, 'box');

  -- 26/02/2026 — delivery B: tomatoes + garlic
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-26', '2026-02-26', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tomato, 2, 1150, 'box'),
    (oid, p_garlic, 2,  600, 'retail_unit');

END $$;
