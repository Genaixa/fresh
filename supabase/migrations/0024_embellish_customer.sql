-- 0024: Embellish wholesale customer + order history
-- Items not in catalogue skipped: fondant potato, baby corn, potato chips,
-- sweet potato chips, red cabbage, red/green chilli, jalapeno,
-- horseradish, red onions, green beans, mini pot

-- 1. Create customer
INSERT INTO wholesale_customers (id, name, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000001', 'Embellish', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Embellish';

-- 2. Order history (11 orders, Mar 2026)
-- Using a temp mapping table for product ids
DO $$
DECLARE
  cid  uuid := '11111111-1111-1111-1111-000000000001';
  oid  uuid;

  -- product ids
  p_celery     uuid := '08e3bfd2-b87c-4a1b-8229-8a93b3febbe9';
  p_tomato     uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_garlic     uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_leek       uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_cabwhite   uuid := '5c925564-a9c0-4a84-badc-b44ec82c2c4b';
  p_mushroom   uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_onion      uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_potato     uuid := '32818a27-e07f-43d9-a957-2a90aac27181';
  p_sweetpot   uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_ypep       uuid := '298c882e-26db-4c5c-bc08-40035214a9e1';
  p_rpep       uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_cherry     uuid := 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb';
  p_auberg     uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_cucumber   uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_celeriac   uuid := 'd19e1db9-6c21-42c2-bbb2-f72d3a595d07';
  p_swede      uuid := '28ff7b46-5d20-4beb-9bd0-997eeb750500';
  p_parsnip    uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_potmids    uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_carrot     uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_courgette  uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_avocado    uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_lemon      uuid := 'e2838162-83b6-41d9-85c2-d04f4f445967';
  p_cress      uuid := '37b38db2-5697-4dae-8200-f292bcd2032c';

BEGIN

  -- ── 05/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-05', '2026-03-05', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_celery,   1,  1260, 'box'),
    (oid, p_tomato,   1,  1180, 'box'),
    (oid, p_garlic,   2,   600, 'retail_unit'),
    (oid, p_leek,     1,   710, 'box'),
    (oid, p_cabwhite, 1,  1050, 'box'),
    (oid, p_mushroom, 1,   770, 'box'),
    (oid, p_onion,    1,  1750, 'box');

  -- ── 06/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-06', '2026-03-06', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,   2,  1300, 'box'),
    (oid, p_onion,    1,  1750, 'box'),
    (oid, p_sweetpot, 1,  1150, 'box'),
    (oid, p_ypep,     1,  1800, 'box'),
    (oid, p_lemon,    1,   480, 'box'),
    (oid, p_cress,    1,   264, 'box');

  -- ── 09/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-09', '2026-03-09', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_garlic,   6,   600, 'retail_unit'),
    (oid, p_onion,    6,  1750, 'box'),
    (oid, p_potato,   8,  1300, 'box'),
    (oid, p_cherry,   1,   910, 'box'),
    (oid, p_rpep,     1,  1850, 'box'),
    (oid, p_cabwhite, 1,  1050, 'box'),
    (oid, p_mushroom, 3,   770, 'box'),
    (oid, p_potmids,  8,   499, 'retail_unit'),
    (oid, p_auberg,   4,  1550, 'box'),
    (oid, p_cucumber, 1,   900, 'box'),
    (oid, p_celeriac, 1,   940, 'retail_unit'),
    (oid, p_swede,    1,   650, 'retail_unit'),
    (oid, p_parsnip,  1,   800, 'box');

  -- ── 11/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-11', '2026-03-11', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    2,  1750, 'box'),
    (oid, p_auberg,   1,  1700, 'box'),
    (oid, p_mushroom, 1,   770, 'box');

  -- ── 12/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-12', '2026-03-12', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 1, 770, 'box');

  -- ── 16/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-16', '2026-03-16', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_garlic,   6,   600, 'retail_unit'),
    (oid, p_onion,    6,  1600, 'box'),
    (oid, p_potato,   8,  1300, 'box'),
    (oid, p_cherry,   1,  1500, 'box'),
    (oid, p_cabwhite, 1,  1100, 'box'),
    (oid, p_mushroom, 2,   770, 'box'),
    (oid, p_potmids,  8,   499, 'retail_unit'),
    (oid, p_auberg,   2,  1650, 'box'),
    (oid, p_cucumber, 1,  1050, 'box'),
    (oid, p_leek,     1,   700, 'box'),
    (oid, p_carrot,   1,   950, 'box');

  -- ── 18/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-18', '2026-03-18', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_auberg,   1,    0, 'box'),
    (oid, p_mushroom, 2,  770, 'box'),
    (oid, p_cucumber, 1, 1350, 'box');

  -- ── 19-20/03/2026 ──────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-19', '2026-03-19', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato, 1, 1300, 'box');

  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-20', '2026-03-20', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potato,     2,  1300, 'box'),
    (oid, p_potmids,    8,   499, 'retail_unit'),
    (oid, p_courgette,  1,  1300, 'box'),
    (oid, p_rpep,       1,  1650, 'box'),
    (oid, p_ypep,       1,  1650, 'box');

  -- ── 23/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-23', '2026-03-23', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids,  8,   499, 'retail_unit'),
    (oid, p_leek,     1,   700, 'box'),
    (oid, p_sweetpot, 1,  1250, 'box'),
    (oid, p_carrot,   1,   950, 'box'),
    (oid, p_avocado,  1,  1910, 'box'),
    (oid, p_cherry,   1,  1500, 'box'),
    (oid, p_auberg,   1,  1500, 'box'),
    (oid, p_mushroom, 1,   770, 'box');

  -- ── 24/03/2026 ─────────────────────────────────────────────────────────────
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-24', '2026-03-24', 'dispatched')
  RETURNING id INTO oid;

  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 1,   950, 'box'),
    (oid, p_mushroom, 1,   770, 'box'),
    (oid, p_leek,     1,   700, 'box'),
    (oid, p_celeriac, 1,   940, 'retail_unit'),
    (oid, p_sweetpot, 1,  1240, 'box'),
    (oid, p_cherry,   1,  1600, 'box'),
    (oid, p_onion,    4,  1900, 'box'),
    (oid, p_potato,   5,  1300, 'box'),
    (oid, p_potmids,  8,   499, 'retail_unit');

END $$;
