-- 0032: Grynhaus wholesale customer + December 2025 order history
-- Email: bgrynhaus@gmail.com (private individual, no org name)
-- Total: £1,405.10 across 6 deliveries (02 Dec – 23 Dec 2025)
-- Note: 23/12 is a large pre-Chanukah bulk order (7 potatoes, 5 onions etc.)
-- Note: 11/12 is a single-item delivery (tomato only)
-- Note: lemons on 23/12 are individual retail units at £0.40 each

-- 1. Grynhaus customer
INSERT INTO wholesale_customers (id, name, email, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000008', 'Grynhaus', 'bgrynhaus@gmail.com', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Grynhaus', email = 'bgrynhaus@gmail.com';

-- 2. Order history
DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000008';
  oid         uuid;
  p_potato    uuid := '32818a27-e07f-43d9-a957-2a90aac27181';
  p_onion     uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_mushroom  uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_cherry    uuid := 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb';
  p_leek      uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_potmids   uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_tangerine uuid := '3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
  p_avocado   uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_cucumber  uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_tomato    uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_ypep      uuid := '298c882e-26db-4c5c-bc08-40035214a9e1';
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_sweetpot  uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_banana    uuid := 'd85d0d21-166f-4fcb-967d-df877ee9b56a';
  p_celeriac  uuid := 'd19e1db9-6c21-42c2-bbb2-f72d3a595d07';
  p_apple     uuid := 'aa4c8f1e-92d0-4948-b630-1f3c29488bb0';
  p_garlic    uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_auberg    uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_butternut uuid := '31b54cad-4d38-4cb1-b9d6-091deacd53b3';
  p_grapes    uuid := 'df8d618e-d7da-4755-b47c-b89217b80d50';
  p_lemon     uuid := 'e2838162-83b6-41d9-85c2-d04f4f445967';
  p_pear      uuid;
BEGIN
  SELECT id INTO p_pear FROM products WHERE name = 'Pear Conference' LIMIT 1;

  -- 02/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-02', '2025-12-02', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    1, 1200, 'box'),
    (oid, p_onion,     2, 1750, 'box'),
    (oid, p_rpep,      1, 1650, 'box'),
    (oid, p_mushroom,  1,  770, 'box'),
    (oid, p_cherry,    2,  820, 'box'),
    (oid, p_leek,      3,  760, 'box'),
    (oid, p_potmids,   2, 1150, 'box'),
    (oid, p_pear,      1, 2300, 'box'),
    (oid, p_tangerine, 1, 2200, 'box'),
    (oid, p_avocado,   1, 1910, 'box');

  -- 05/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-05', '2025-12-05', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    1, 1300, 'box'),
    (oid, p_onion,     2, 1750, 'box'),
    (oid, p_cucumber,  2, 1550, 'box'),
    (oid, p_tomato,    1,  810, 'box'),
    (oid, p_ypep,      1, 1350, 'box'),
    (oid, p_carrot,    1, 1160, 'box'),
    (oid, p_sweetpot,  1,  810, 'box'),
    (oid, p_courgette, 1,  930, 'box'),
    (oid, p_banana,    1, 2300, 'box'),
    (oid, p_mushroom,  2,  770, 'box');

  -- 08/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-08', '2025-12-08', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cherry,   2,  950, 'box'),
    (oid, p_rpep,     1, 1400, 'box'),
    (oid, p_ypep,     1, 1400, 'box'),
    (oid, p_potmids,  2, 1150, 'box'),
    (oid, p_mushroom, 1,  770, 'box'),
    (oid, p_leek,     3,  760, 'box'),
    (oid, p_pear,     1, 2300, 'box'),
    (oid, p_celeriac, 1,  940, 'box');

  -- 11/12/2025 — single-item delivery
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-11', '2025-12-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_tomato, 1, 910, 'box');

  -- 12/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-12', '2025-12-12', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    3, 1300, 'box'),
    (oid, p_onion,     1, 1750, 'box'),
    (oid, p_tangerine, 1, 2400, 'box'),
    (oid, p_apple,     1, 2500, 'box'),
    (oid, p_cucumber,  1, 1660, 'box'),
    (oid, p_garlic,    2,  600, 'retail_unit'),
    (oid, p_rpep,      1, 1450, 'box'),
    (oid, p_potmids,   2, 1150, 'box'),
    (oid, p_banana,    1, 2300, 'box'),
    (oid, p_mushroom,  2,  770, 'box'),
    (oid, p_auberg,    1, 2000, 'box');

  -- 23/12/2025 — pre-Chanukah bulk order
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-23', '2025-12-23', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,    7, 1300, 'box'),
    (oid, p_onion,     5, 1750, 'box'),
    (oid, p_butternut, 1, 1250, 'box'),
    (oid, p_sweetpot,  1,  950, 'box'),
    (oid, p_courgette, 1, 1200, 'box'),
    (oid, p_tangerine, 2, 2400, 'box'),
    (oid, p_cucumber,  4, 1650, 'box'),
    (oid, p_tomato,    2,  850, 'box'),
    (oid, p_rpep,      2, 1500, 'box'),
    (oid, p_ypep,      1, 1500, 'box'),
    (oid, p_carrot,    2, 1160, 'box'),
    (oid, p_garlic,    2,  600, 'retail_unit'),
    (oid, p_apple,     1, 2500, 'box'),
    (oid, p_banana,    1, 2300, 'box'),
    (oid, p_grapes,    1, 1800, 'box'),
    (oid, p_cherry,    4,  850, 'box'),
    (oid, p_potmids,   2, 1150, 'box'),
    (oid, p_auberg,    2, 2000, 'box'),
    (oid, p_leek,      6,  770, 'box'),
    (oid, p_mushroom,  1,  770, 'box'),
    (oid, p_lemon,    10,   40, 'retail_unit'),
    (oid, p_pear,      1, 2300, 'box');

END $$;
