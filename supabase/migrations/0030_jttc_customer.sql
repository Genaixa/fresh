-- 0030: JTTC wholesale customer + February 2026 order history
-- Email: office@jttc.org.uk
-- Total: ~£6,142 across 23 deliveries (01 Feb – 27 Feb 2026)
-- New product: Red Onion
-- Notes:
--   26/02 pears entered at £0 (blank on invoice) — included as-is, flag for David
--   25/02 "sweet potato on shop" — single item apparently taken from shop stock
--   "ready peeled garlic (kg)" mapped to Garlic — confirm with David
--   "plums" mapped to Plum (currently inactive) — historical order, status irrelevant

-- 1. New product: Red Onion
INSERT INTO products (name, category, unit, retail_price, wholesale_price,
                      purchase_cost, price_multiplier, margin_floor, is_active)
VALUES ('Red Onion', 'veg', 'each', 0, 0, 0, 2.00, 0.20, true)
ON CONFLICT DO NOTHING;

-- 2. JTTC customer
INSERT INTO wholesale_customers (id, name, email, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000006', 'JTTC', 'office@jttc.org.uk', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'JTTC', email = 'office@jttc.org.uk';

-- 3. Order history
DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000006';
  oid         uuid;
  -- hardcoded UUIDs
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_potato    uuid := '32818a27-e07f-43d9-a957-2a90aac27181';
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';  -- spanish/regular onion
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
  p_potmids   uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';  -- baby potatoes
  p_leek      uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_avocado   uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_banana    uuid := 'd85d0d21-166f-4fcb-967d-df877ee9b56a';
  p_cabwhite  uuid := '5c925564-a9c0-4a84-badc-b44ec82c2c4b';
  p_sweetpot  uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_parsnip   uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_cress     uuid := '37b38db2-5697-4dae-8200-f292bcd2032c';
  p_apple     uuid := 'aa4c8f1e-92d0-4948-b630-1f3c29488bb0';  -- Royal Gala / generic
  -- looked up by name
  p_red_onion  uuid;
  p_potbaker   uuid;
  p_pear       uuid;
  p_apple_pink uuid;
  p_red_cab    uuid;
  p_grapefruit uuid;
  p_plum       uuid;
  p_kiwi       uuid;
  p_passion    uuid;
  p_mango      uuid;
  p_melon_hd   uuid;
  p_turnip     uuid;
BEGIN
  SELECT id INTO p_red_onion  FROM products WHERE name = 'Red Onion'        LIMIT 1;
  SELECT id INTO p_potbaker   FROM products WHERE name = 'Potato Sack'     LIMIT 1;
  SELECT id INTO p_pear       FROM products WHERE name = 'Pear Conference'  LIMIT 1;
  SELECT id INTO p_apple_pink FROM products WHERE name = 'Apple Pink Lady'  LIMIT 1;
  SELECT id INTO p_red_cab    FROM products WHERE name = 'Red Cabbage'      LIMIT 1;
  SELECT id INTO p_grapefruit FROM products WHERE name = 'Grapefruit'       LIMIT 1;
  SELECT id INTO p_plum       FROM products WHERE name = 'Plum'             LIMIT 1;
  SELECT id INTO p_kiwi       FROM products WHERE name = 'Kiwi Loose'             LIMIT 1;
  SELECT id INTO p_passion    FROM products WHERE name = 'Passion Fruit'    LIMIT 1;
  SELECT id INTO p_mango      FROM products WHERE name = 'Mango'            LIMIT 1;
  SELECT id INTO p_melon_hd   FROM products WHERE name = 'Melon Honeydew'   LIMIT 1;
  SELECT id INTO p_turnip     FROM products WHERE name = 'Turnip'           LIMIT 1;

  -- 01/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-01', '2026-02-01', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot, 1, 750, 'box');

  -- 03/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-03', '2026-02-03', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_avocado,  3, 1910, 'box'),
    (oid, p_mushroom, 3,  840, 'box'),
    (oid, p_banana,   1, 2250, 'box'),
    (oid, p_pear,     4, 2300, 'box'),
    (oid, p_cucumber, 4, 1300, 'box'),
    (oid, p_tomato,   2, 1650, 'box'),
    (oid, p_potato,   1, 1400, 'box');

  -- 04/02/2026 — delivery A: cherry tomatoes, leek, apples, onion
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-04', '2026-02-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cherry,   4, 1550, 'box'),
    (oid, p_mushroom, 4, 1150, 'box'),
    (oid, p_leek,     2,  710, 'box'),
    (oid, p_apple,    4, 2300, 'box'),
    (oid, p_onion,    1, 1750, 'box');

  -- 04/02/2026 — delivery B: small mushroom trays
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-04', '2026-02-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 4, 810, 'retail_unit');

  -- 04/02/2026 — delivery C: fruit & salad run
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-04', '2026-02-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_banana,    1, 2250, 'box'),
    (oid, p_potmids,   1, 1050, 'box'),
    (oid, p_red_onion, 1,  740, 'box'),
    (oid, p_rpep,      4, 2000, 'box'),
    (oid, p_ypep,      2, 2500, 'box'),
    (oid, p_cucumber,  4, 1300, 'box'),
    (oid, p_tomato,    2, 1650, 'box'),
    (oid, p_sweetpot, 10,  850, 'retail_unit'),  -- skinny sweet potatoes per kg
    (oid, p_tangerine, 4, 2200, 'box'),
    (oid, p_grapefruit,1, 2200, 'box');

  -- 06/02/2026 — delivery A: apples + banana
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-06', '2026-02-06', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_apple,  4, 2300, 'box'),
    (oid, p_banana, 1, 2250, 'box');

  -- 06/02/2026 — delivery B: salad + mushroom + potatoes
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-06', '2026-02-06', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 2, 1150, 'box'),
    (oid, p_potmids,  4, 1050, 'box'),
    (oid, p_cucumber, 4, 1300, 'box'),
    (oid, p_tomato,   2, 1650, 'box');

  -- 08/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-08', '2026-02-08', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_rpep,    2, 2000, 'box'),
    (oid, p_ypep,    1, 2200, 'box'),
    (oid, p_cucumber,2, 1100, 'box'),
    (oid, p_potato,  4, 1400, 'box'),
    (oid, p_onion,   1, 1750, 'box'),
    (oid, p_apple,   3, 2300, 'box'),
    (oid, p_cabwhite,1, 1050, 'box');

  -- 09/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-09', '2026-02-09', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potbaker, 3, 1090, 'retail_unit'),  -- baking potatoes per kg
    (oid, p_cucumber, 4, 1400, 'box'),
    (oid, p_rpep,     2, 2000, 'box'),
    (oid, p_mushroom, 4, 1150, 'box'),
    (oid, p_pear,     4, 2300, 'box'),
    (oid, p_banana,   1, 2250, 'box');

  -- 10/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-10', '2026-02-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato, 3, 1400, 'box');

  -- 11/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-11', '2026-02-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tangerine, 4, 2200, 'box'),
    (oid, p_banana,    1, 2250, 'box'),
    (oid, p_red_onion, 1,  710, 'box'),
    (oid, p_cucumber,  4, 1300, 'box'),
    (oid, p_rpep,      4, 2000, 'box'),
    (oid, p_apple,     4, 2400, 'box'),
    (oid, p_grapefruit,1, 2200, 'box'),
    (oid, p_tomato,    2, 1450, 'box'),
    (oid, p_plum,      2, 1700, 'box'),
    (oid, p_red_cab,   1, 1150, 'box'),
    (oid, p_avocado,   3, 1910, 'box');

  -- 13/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-13', '2026-02-13', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_avocado,   4, 1910, 'box'),
    (oid, p_mushroom,  2, 1150, 'box'),
    (oid, p_red_onion, 1,  710, 'box'),
    (oid, p_banana,    1, 2250, 'box'),
    (oid, p_rpep,      4, 2000, 'box'),
    (oid, p_tomato,    2, 1450, 'box'),
    (oid, p_cucumber,  4, 1300, 'box'),
    (oid, p_apple,     4, 2300, 'box');

  -- 16/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-16', '2026-02-16', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_apple,    4, 2300, 'box'),
    (oid, p_onion,    1, 1750, 'box'),
    (oid, p_cucumber, 4, 1300, 'box');

  -- 17/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-17', '2026-02-17', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_banana,  1, 2250, 'box'),
    (oid, p_avocado, 4, 1910, 'box'),
    (oid, p_mushroom,4, 1150, 'box'),
    (oid, p_cucumber,4, 1200, 'box'),
    (oid, p_tomato,  2, 1200, 'box'),
    (oid, p_pear,    1, 2300, 'box'),
    (oid, p_cabwhite,1, 1060, 'box'),
    (oid, p_potato,  4, 1400, 'box');

  -- 18/02/2026 — delivery A (abbreviated entries: apple, onion, carrot + baby pots run)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-18', '2026-02-18', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_apple,    4, 2300, 'box'),
    (oid, p_onion,    1, 1750, 'box'),
    (oid, p_carrot,   1,  760, 'box'),
    (oid, p_potmids,  6, 1050, 'box'),
    (oid, p_cucumber, 2, 1150, 'box'),
    (oid, p_rpep,     2, 1800, 'box'),
    (oid, p_ypep,     2, 2000, 'box');

  -- 18/02/2026 — delivery B (full-date entries)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-18', '2026-02-18', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids,   2, 1060, 'box'),
    (oid, p_avocado,   2, 1910, 'box'),
    (oid, p_mushroom,  2, 1150, 'box'),
    (oid, p_red_onion, 1,  910, 'box'),
    (oid, p_potato,    1, 1400, 'box'),
    (oid, p_banana,    1, 2250, 'box'),
    (oid, p_cucumber,  4, 1100, 'box'),
    (oid, p_carrot,    1,  760, 'box'),
    (oid, p_rpep,      2, 1700, 'box'),
    (oid, p_plum,      4, 1650, 'box'),
    (oid, p_tangerine, 2, 2200, 'box');

  -- 19/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-19', '2026-02-19', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_garlic,  6,  600, 'retail_unit'),  -- ready peeled garlic per kg
    (oid, p_avocado, 4, 1950, 'box'),
    (oid, p_pear,    4, 2300, 'box'),
    (oid, p_banana,  1, 2250, 'box'),
    (oid, p_tomato,  2, 1300, 'box'),
    (oid, p_ypep,    2, 2000, 'box'),          -- orange/yellow pepper
    (oid, p_auberg,  2, 1250, 'box');

  -- 22/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-22', '2026-02-22', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_rpep,      2, 1800, 'box'),
    (oid, p_ypep,      2, 1850, 'box'),
    (oid, p_courgette, 2, 1100, 'box'),
    (oid, p_red_onion, 2,  850, 'box'),
    (oid, p_mushroom,  4,  770, 'retail_unit'),
    (oid, p_avocado,   4, 1910, 'box'),
    (oid, p_apple,     4, 2400, 'box'),
    (oid, p_onion,     1, 1750, 'box'),
    (oid, p_potmids,   3, 1050, 'box');

  -- 23/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-23', '2026-02-23', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom,   6,  810, 'retail_unit'),  -- baby mushroom trays
    (oid, p_cucumber,   6, 1400, 'box'),
    (oid, p_auberg,     2, 1160, 'box'),
    (oid, p_banana,     1, 2250, 'box'),
    (oid, p_apple_pink, 2, 2400, 'box'),
    (oid, p_mushroom,   4, 1150, 'box'),
    (oid, p_rpep,       2, 1700, 'box'),
    (oid, p_potato,     4, 1400, 'box');

  -- 24/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-24', '2026-02-24', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_red_onion, 0.5,  800, 'box'),   -- 0.5 sack
    (oid, p_mushroom,  4,   1150, 'box'),
    (oid, p_cherry,    4,   1400, 'box'),
    (oid, p_leek,      2,    710, 'retail_unit'),
    (oid, p_pear,      4,   2300, 'box'),
    (oid, p_red_onion, 1,    850, 'box'),   -- red onion (small)
    (oid, p_onion,     1,   1750, 'box'),
    (oid, p_mushroom,  16,   810, 'retail_unit');  -- small mushroom trays

  -- 25/02/2026 — single sweet potato item (from shop stock)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-25', '2026-02-25', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_sweetpot, 1, 1000, 'retail_unit');

  -- 26/02/2026 — pears entered at £0 on original invoice
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-26', '2026-02-26', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_rpep,    4, 1700, 'box'),
    (oid, p_tomato,  2, 1150, 'box'),
    (oid, p_banana,  1, 2250, 'box'),
    (oid, p_pear,    4,    0, 'box'),    -- blank price on original invoice
    (oid, p_turnip,  2, 1050, 'retail_unit'),
    (oid, p_parsnip, 2,  850, 'retail_unit'),
    (oid, p_onion,   1, 1750, 'box'),
    (oid, p_cucumber,2, 1200, 'box');

  -- 27/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-27', '2026-02-27', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_kiwi,     3, 1100, 'box'),
    (oid, p_pineapple,2, 1600, 'box'),
    (oid, p_grapes,   2, 2000, 'box'),
    (oid, p_passion,  3, 1500, 'box'),
    (oid, p_mango,    5, 1300, 'box'),
    (oid, p_melon_hd, 2, 1500, 'box'),
    (oid, p_cress,    2,  500, 'retail_unit'),
    (oid, p_cherry,   1, 1200, 'box'),
    (oid, p_mushroom, 6,  810, 'retail_unit'),  -- baby mushroom trays
    (oid, p_banana,   1, 2250, 'box'),
    (oid, p_potmids,  2, 1050, 'box'),
    (oid, p_tangerine,2, 2000, 'box'),
    (oid, p_cucumber, 4, 1200, 'box'),
    (oid, p_mushroom, 4, 1150, 'retail_unit'),  -- mushroom prepack
    (oid, p_rpep,     4, 1650, 'box'),
    (oid, p_apple,    4, 2300, 'box'),
    (oid, p_red_onion,1,  740, 'box'),
    (oid, p_potato,   4, 1400, 'box'),
    (oid, p_carrot,   1,  750, 'box');

END $$;
