-- 0031: Baer wholesale customer + September 2025 order history
-- Primary email: ras@baer.org.uk (R Salzer); secondary: kitchen@baer.org.uk
-- Total: £1,504.08 across 20 deliveries (01 Sep – 29 Sep 2025)
-- Potato mapping:
--   pot kugel / kugel pot  → Potato (standard sacks)
--   pot roast / roast pot  → Potato Baker (floury roasting potatoes)
--   pot mash  / mash pot   → Potato Mids (small potatoes, good for mash)
--   mini pot               → Potato Mids retail_unit (individual bags at £4.99)
--   prepack pot            → Potato retail_unit (prepackaged bag)
--   pot (16/09, ambiguous) → Potato
-- Questions for David: confirm potato mappings; what does BAER stand for?

-- 1. Baer customer
INSERT INTO wholesale_customers (id, name, email, contact_name, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000007', 'Baer', 'ras@baer.org.uk', 'R Salzer', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Baer', email = 'ras@baer.org.uk', contact_name = 'R Salzer';

-- 2. Order history
DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000007';
  oid         uuid;
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_potato    uuid := '32818a27-e07f-43d9-a957-2a90aac27181';
  p_potmids   uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_celery    uuid := '08e3bfd2-b87c-4a1b-8229-8a93b3febbe9';
  p_swede     uuid := '28ff7b46-5d20-4beb-9bd0-997eeb750500';
  p_leek      uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_cherry    uuid := 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb';
  p_mushroom  uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_grapes    uuid := 'df8d618e-d7da-4755-b47c-b89217b80d50';
  p_butternut uuid := '31b54cad-4d38-4cb1-b9d6-091deacd53b3';
  p_sweetpot  uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_parsnip   uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_celeriac  uuid := 'd19e1db9-6c21-42c2-bbb2-f72d3a595d07';
  p_tomato    uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_cucumber  uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_ypep      uuid := '298c882e-26db-4c5c-bc08-40035214a9e1';
  p_auberg    uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_cabwhite  uuid := '5c925564-a9c0-4a84-badc-b44ec82c2c4b';
  p_garlic    uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_banana    uuid := 'd85d0d21-166f-4fcb-967d-df877ee9b56a';
  p_potbaker  uuid;
BEGIN
  SELECT id INTO p_potbaker FROM products WHERE name = 'Potato Sack' LIMIT 1;

  -- 01/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-01', '2025-09-01', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    1, 2000, 'box'),
    (oid, p_potato,   2, 1450, 'box'),      -- pot kugel
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_swede,    1,  750, 'box'),
    (oid, p_potbaker, 1, 1450, 'box'),      -- pot roast
    (oid, p_potmids,  10,  499, 'retail_unit'); -- mini pot bags

  -- 03/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-03', '2025-09-03', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_leek,     1,  910, 'box'),
    (oid, p_onion,    1, 2000, 'box'),
    (oid, p_cherry,   1,  710, 'box'),
    (oid, p_mushroom, 1,  770, 'box'),
    (oid, p_courgette,1,  960, 'box'),
    (oid, p_potmids,  1,  760, 'box'),      -- pot mash
    (oid, p_grapes,   1, 2200, 'box');

  -- 04/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-04', '2025-09-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_leek,     1, 940, 'box'),
    (oid, p_mushroom, 1, 770, 'box');

  -- 05/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-05', '2025-09-05', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cabwhite, 1, 1250, 'box'),
    (oid, p_butternut,1, 1250, 'box'),
    (oid, p_sweetpot, 1, 1050, 'box'),
    (oid, p_potato,   2, 1450, 'box'),      -- pot kugel
    (oid, p_parsnip,  1,  850, 'box'),
    (oid, p_celeriac, 1,  940, 'box'),
    (oid, p_tomato,   1, 1100, 'box'),
    (oid, p_cucumber, 1,  670, 'box'),
    (oid, p_mushroom, 1,  770, 'box'),
    (oid, p_potmids,  1,  810, 'box'),      -- pot mash
    (oid, p_potbaker, 1, 1450, 'box'),      -- pot roast
    (oid, p_carrot,   1, 1090, 'box');

  -- 08/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-08', '2025-09-08', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,   1,  1900, 'box'),
    (oid, p_cucumber,1,   850, 'box'),
    (oid, p_rpep,    1,   960, 'box'),
    (oid, p_ypep,    1,  1160, 'box'),
    (oid, p_potato,  1,  1120, 'retail_unit'); -- prepack pot

  -- 09/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-09', '2025-09-09', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 2,  860, 'box'),
    (oid, p_onion,    1, 1900, 'box'),
    (oid, p_banana,   1, 2350, 'box'),
    (oid, p_garlic,   4,  600, 'retail_unit'); -- peeled garlic j

  -- 10/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-10', '2025-09-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 1,  860, 'box'),
    (oid, p_swede,    1,  610, 'box'),
    (oid, p_leek,     2,  910, 'box'),
    (oid, p_potbaker, 1, 1200, 'box'),      -- pot roast
    (oid, p_onion,    1, 1900, 'box'),
    (oid, p_celeriac, 1,  940, 'box'),
    (oid, p_carrot,   1, 1080, 'box');

  -- 11/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-11', '2025-09-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_garlic,    1,  600, 'retail_unit'),
    (oid, p_celery,    1,  149, 'retail_unit'),
    (oid, p_mushroom,  1,  770, 'box'),
    (oid, p_courgette, 1, 1200, 'box');

  -- 12/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-12', '2025-09-12', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot,   1, 1080, 'box'),
    (oid, p_potato,   2, 1250, 'box'),      -- pot kugel
    (oid, p_sweetpot, 1, 1080, 'box'),
    (oid, p_butternut,1, 1250, 'box'),
    (oid, p_cucumber, 1,  950, 'box'),
    (oid, p_mushroom, 1,  770, 'box'),
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_celeriac, 1,  940, 'box'),
    (oid, p_onion,    1, 1900, 'box'),
    (oid, p_swede,    1,  610, 'box');

  -- 15/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-15', '2025-09-15', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids,  12,  499, 'retail_unit'), -- mini pot bags
    (oid, p_potato,   2,  1250, 'box'),          -- kugel pot
    (oid, p_auberg,   1,  1550, 'box'),
    (oid, p_celery,   1,   149, 'retail_unit'),
    (oid, p_carrot,   1,  1080, 'box'),
    (oid, p_onion,    1,  1800, 'box');

  -- 16/09/2025 — delivery A: celery only
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-16', '2025-09-16', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_celery, 1, 149, 'retail_unit');

  -- 16/09/2025 — delivery B: one box of potatoes (type unspecified)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-16', '2025-09-16', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato, 1, 1450, 'box');

  -- 17/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-17', '2025-09-17', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tomato,   1, 1050, 'box'),
    (oid, p_cucumber, 1,  910, 'box'),
    (oid, p_onion,    1, 1800, 'box'),
    (oid, p_potmids,  1,  760, 'box'),      -- mash pot
    (oid, p_cherry,   1, 1050, 'box'),
    (oid, p_leek,     1,  910, 'box');

  -- 18/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-18', '2025-09-18', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    1, 1800, 'box'),
    (oid, p_potbaker, 1, 1250, 'box'),      -- roast pot
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_celeriac, 1,  940, 'box'),
    (oid, p_parsnip,  1,  910, 'box'),
    (oid, p_mushroom, 1,  770, 'box');

  -- 19/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-19', '2025-09-19', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cabwhite,  1, 1300, 'box'),
    (oid, p_onion,     1, 1800, 'box'),
    (oid, p_potmids,   1,  760, 'box'),     -- pot mash
    (oid, p_potbaker,  2, 1250, 'box'),     -- pot roast
    (oid, p_courgette, 1, 1250, 'box'),
    (oid, p_cucumber,  1,  910, 'box'),
    (oid, p_tomato,    1, 1050, 'box');

  -- 22/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-22', '2025-09-22', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot,   1, 1250, 'box'),
    (oid, p_grapes,   1, 2200, 'box'),
    (oid, p_tomato,   1, 1050, 'box'),
    (oid, p_cucumber, 1,  950, 'box'),
    (oid, p_rpep,     1, 1500, 'box'),
    (oid, p_ypep,     1, 1280, 'box'),
    (oid, p_onion,    1, 1800, 'box'),
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_potato,   2, 1250, 'box'),      -- pot kugel
    (oid, p_potbaker, 1, 1250, 'box'),      -- pot roast
    (oid, p_auberg,   1, 1600, 'box'),
    (oid, p_butternut,1, 1250, 'box');

  -- 25/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-25', '2025-09-25', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 1, 1000, 'box'),
    (oid, p_onion,    1, 1800, 'box'),
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_garlic,   4,  600, 'retail_unit');

  -- 26/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-26', '2025-09-26', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    2, 1800, 'box'),
    (oid, p_potato,   2, 1250, 'box'),      -- pot kugel
    (oid, p_cucumber, 1, 1000, 'box'),
    (oid, p_celery,   1,  149, 'retail_unit'),
    (oid, p_butternut,1, 1250, 'box');

  -- 29/09/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-09-29', '2025-09-29', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids, 10,  499, 'retail_unit'), -- mini pot bags
    (oid, p_potbaker, 1, 1250, 'box'),          -- pot roast
    (oid, p_potato,   2, 1250, 'box'),           -- pot kugel
    (oid, p_carrot,   1, 1250, 'box');

END $$;
