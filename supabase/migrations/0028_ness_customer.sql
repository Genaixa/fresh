-- 0028: Ness wholesale customer + Nov 2025 – Mar 2026 order history
-- Contact: Ephraim Serfaty · EFYSERFATY@gmail.com
-- Total: £518.70 across 11 deliveries
-- New product: Potato (Soraya) — specific variety, sold by sack at £12
-- Sourcing TBD: ask David where Soraya potatoes come from
-- "tomato (best)" mapped to Tomato

-- 1. Potato (Soraya) — new product
INSERT INTO products (id, name, category, unit, retail_price, wholesale_price,
                      purchase_cost, price_multiplier, margin_floor, case_size, is_active)
VALUES (
  gen_random_uuid(),
  'Potato (Soraya)',
  'veg',
  'bag',
  1200,   -- £12/sack (Ness sell price — purchase cost unknown)
  1200,
  0,
  2.00,
  0.20,
  1,
  true
)
ON CONFLICT DO NOTHING;

-- 2. Ness customer
INSERT INTO wholesale_customers (id, name, email, contact_name, is_internal, is_active)
VALUES (
  '11111111-1111-1111-1111-000000000004',
  'Ness', 'EFYSERFATY@gmail.com', 'Ephraim Serfaty', false, true
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Ness', email = 'EFYSERFATY@gmail.com', contact_name = 'Ephraim Serfaty';

-- 3. Order history
DO $$
DECLARE
  cid         uuid := '11111111-1111-1111-1111-000000000004';
  oid         uuid;
  p_garlic    uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_avocado   uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_mushroom  uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_carrot    uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_cucumber  uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_auberg    uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_rpep      uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_tomato    uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_soraya    uuid;
BEGIN
  SELECT id INTO p_soraya FROM products WHERE name = 'Potato (Soraya)' LIMIT 1;

  -- 25/11/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-11-25', '2025-11-25', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_garlic, 1, 600, 'retail_unit');

  -- 04/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-04', '2025-12-04', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_avocado, 1, 1800, 'box');

  -- 16/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-16', '2025-12-16', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 5, 770, 'box');

  -- 21/12/2025
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2025-12-21', '2025-12-21', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_soraya, 4, 1200, 'retail_unit');

  -- 11/01/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-01-11', '2026-01-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot, 1, 800, 'box');

  -- 27/01/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-01-27', '2026-01-27', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_soraya,  5, 1200, 'retail_unit'),
    (oid, p_cucumber, 1, 1200, 'box');

  -- 09/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-09', '2026-02-09', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_soraya, 6, 1200, 'retail_unit');

  -- 15/02/2026 — "sacks" confirms unit is a sack
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-15', '2026-02-15', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_soraya, 10, 1200, 'retail_unit');

  -- 17/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-17', '2026-02-17', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_mushroom, 1, 770, 'box');

  -- 24/02/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-02-24', '2026-02-24', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_auberg,  3, 1150, 'box'),
    (oid, p_rpep,    1, 1700, 'box'),
    (oid, p_tomato,  1, 1100, 'box'),
    (oid, p_garlic,  1,  600, 'retail_unit');

  -- 01/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-01', '2026-03-01', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_soraya, 5, 1200, 'retail_unit');

END $$;
