-- 0033: BCR Sem — December 2025 order history (additional to 0026 which covers Mar 2026)
-- Customer already exists: cid = 11111111-1111-1111-1111-000000000003
-- Total stated: £865.77 across 6 deliveries (01 Dec – 11 Dec 2025)
-- Skipped: "fruit" on 08/12 (£22, too generic — see question 27 below)
-- "celeriac 8" = celeriac with size/pack code, mapped to Celeriac
-- "tangerine" appears twice on 01/12 — included as two separate line items
-- "peeled potato" = Potato (Ready Peeled) bags at £1.91 each (added in 0027)

-- ensure customer record is current
INSERT INTO wholesale_customers (id, name, email, contact_name, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000003', 'BCR Sem', 'accounts@bcrsem.org.uk', 'Z Sulzbacher', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'BCR Sem', email = 'accounts@bcrsem.org.uk', contact_name = 'Z Sulzbacher';

DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000003';
  oid         uuid;
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_cucumber  uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_ypep      uuid := '298c882e-26db-4c5c-bc08-40035214a9e1';
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_sweetpot  uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_tangerine uuid := '3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_tomato    uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_auberg    uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_lemon     uuid := 'e2838162-83b6-41d9-85c2-d04f4f445967';
  p_celeriac  uuid := 'd19e1db9-6c21-42c2-bbb2-f72d3a595d07';
  p_parsnip   uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_banana    uuid := 'd85d0d21-166f-4fcb-967d-df877ee9b56a';
  p_grapes    uuid := 'df8d618e-d7da-4755-b47c-b89217b80d50';
  p_garlic    uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_avocado   uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_potmids   uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_potbaker  uuid;
  p_apple_pink uuid;
  p_orange    uuid;
  p_rp        uuid;  -- Potato (Ready Peeled)
BEGIN
  SELECT id INTO p_potbaker   FROM products WHERE name = 'Potato Sack'          LIMIT 1;
  SELECT id INTO p_apple_pink FROM products WHERE name = 'Apple Pink Lady'       LIMIT 1;
  SELECT id INTO p_orange     FROM products WHERE name = 'Oranges Large'          LIMIT 1;
  SELECT id INTO p_rp         FROM products WHERE name = 'Potato (Ready Peeled)' LIMIT 1;

  -- 01/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-01', '2025-12-01', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    1, 1650, 'box'),
    (oid, p_cucumber, 2, 1550, 'box'),
    (oid, p_ypep,     1, 1650, 'box'),
    (oid, p_carrot,   2, 1160, 'box'),
    (oid, p_sweetpot, 2,  810, 'box'),
    (oid, p_orange,   1, 2400, 'box'),
    (oid, p_tangerine,1, 2200, 'box'),
    (oid, p_tangerine,1, 2200, 'box'),   -- appears twice on invoice
    (oid, p_potbaker, 1, 1150, 'box'),
    (oid, p_courgette,2,  930, 'box');

  -- 04/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-04', '2025-12-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber,  2,  980, 'box'),
    (oid, p_tomato,    1,  850, 'box'),
    (oid, p_sweetpot,  2,  850, 'box'),
    (oid, p_auberg,    2, 1500, 'box'),
    (oid, p_lemon,    10,   40, 'retail_unit'),
    (oid, p_carrot,    2, 1160, 'box'),
    (oid, p_celeriac,  1, 1140, 'box'),
    (oid, p_parsnip,   0.5, 900, 'box'),
    (oid, p_rpep,      1, 1650, 'box'),
    (oid, p_banana,    1, 2300, 'box'),
    (oid, p_grapes,    1, 1800, 'box'),
    (oid, p_garlic,    1,  600, 'retail_unit');

  -- 08/12/2025 — "fruit" (£22) skipped: see question 27
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-08', '2025-12-08', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potbaker,   1, 1100, 'box'),
    (oid, p_sweetpot,   2,  810, 'box'),
    (oid, p_carrot,     1,  650, 'box'),
    (oid, p_apple_pink, 1, 2500, 'box');

  -- 09/12/2025 — Potato (Ready Peeled) bags
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-09', '2025-12-09', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_rp, 25, 191, 'retail_unit');

  -- 10/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-10', '2025-12-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids,   3, 1050, 'box'),
    (oid, p_cucumber,  1, 1650, 'box'),
    (oid, p_ypep,      1, 1400, 'box'),
    (oid, p_tomato,    1,  910, 'box'),
    (oid, p_avocado,   2, 1910, 'box'),
    (oid, p_apple_pink,1, 2500, 'box'),
    (oid, p_tangerine, 1, 2400, 'box');

  -- 11/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-11', '2025-12-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tomato,  2,  910, 'box'),
    (oid, p_onion,   1, 1650, 'box'),
    (oid, p_garlic,  1,  600, 'retail_unit'),
    (oid, p_auberg,  2, 2000, 'box'),
    (oid, p_rpep,    1, 1450, 'box'),
    (oid, p_avocado, 2, 1910, 'box'),
    (oid, p_banana,  1, 2250, 'box'),
    (oid, p_potmids, 8,  499, 'retail_unit');  -- mini potatoes (individual bags)

END $$;
