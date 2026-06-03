-- 0025: Oneg wholesale customer + March 2026 order history
-- Email: accounts@oneg.uk
-- Total: £878.40 across 10 deliveries
-- Skipped: red onions (not in catalogue — 15p each, individual bulbs)
-- Note: onions 11/03 at £1.50 included as-is (likely a credit/adjustment)

INSERT INTO wholesale_customers (id, name, email, is_internal, is_active)
VALUES ('11111111-1111-1111-1111-000000000002', 'Oneg', 'accounts@oneg.uk', false, true)
ON CONFLICT (id) DO UPDATE SET name = 'Oneg', email = 'accounts@oneg.uk';

DO $$
DECLARE
  cid       uuid := '11111111-1111-1111-1111-000000000002';
  oid       uuid;
  p_onion   uuid := '14e6deff-e2c6-4cc2-a7f3-9239b079260e';
  p_tomato  uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_cucumber uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_auberg  uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_mushroom uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
BEGIN

  -- 02/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-02', '2026-03-02', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    1, 1750, 'box'),
    (oid, p_tomato,   1, 1180, 'box'),
    (oid, p_cucumber, 1, 1150, 'box');

  -- 05/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-05', '2026-03-05', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 3, 1050, 'box'),
    (oid, p_tomato,   2, 1180, 'box'),
    (oid, p_auberg,   2, 1300, 'box'),
    (oid, p_onion,    1, 1750, 'box');

  -- 08/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-08', '2026-03-08', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_onion,    1, 1750, 'box'),
    (oid, p_cucumber, 2,  900, 'box'),
    (oid, p_tomato,   1, 1500, 'box'),
    (oid, p_auberg,   2, 1550, 'box'),
    (oid, p_mushroom, 2,  800, 'box');

  -- 10/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-10', '2026-03-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 1,  800, 'box'),
    (oid, p_onion,    1, 1750, 'box'),
    (oid, p_tomato,   1, 1600, 'box');

  -- 11/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-11', '2026-03-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 2,  800, 'box'),
    (oid, p_onion,    1,  150, 'box'),   -- £1.50, likely credit/adjustment
    (oid, p_auberg,   2, 1700, 'box'),
    (oid, p_cucumber, 2,  850, 'box'),
    (oid, p_tomato,   1, 1600, 'box');

  -- 15/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-15', '2026-03-15', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 2,  800, 'box'),
    (oid, p_onion,    1, 1800, 'box'),
    (oid, p_tomato,   2, 1600, 'box'),
    (oid, p_cucumber, 3,  950, 'box'),
    (oid, p_auberg,   2, 1600, 'box');

  -- 18/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-18', '2026-03-18', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 2,  950, 'box'),
    (oid, p_tomato,   1, 1700, 'box'),
    (oid, p_auberg,   2, 1600, 'box'),
    (oid, p_mushroom, 2,  800, 'box'),
    (oid, p_onion,    1, 1800, 'box');

  -- 23/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-23', '2026-03-23', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 2,  800, 'box'),
    (oid, p_cucumber, 2,  750, 'box'),
    (oid, p_auberg,   2, 1550, 'box'),
    (oid, p_tomato,   1, 1700, 'box'),
    (oid, p_onion,    1, 1800, 'box');

  -- 26/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-26', '2026-03-26', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 1,  850, 'box'),
    (oid, p_auberg,   1, 1700, 'box'),
    (oid, p_tomato,   1, 1800, 'box');

  -- 27/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-27', '2026-03-27', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber, 3,  850, 'box'),
    (oid, p_tomato,   2, 1800, 'box'),
    (oid, p_mushroom, 2,  800, 'box'),
    (oid, p_auberg,   3, 1550, 'box'),
    (oid, p_onion,    1, 1800, 'box');

END $$;
