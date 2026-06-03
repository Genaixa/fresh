-- 0027: Add Potato (Ready Peeled) to catalogue
-- Sourced for BCR Sem seminary kitchen — £1.91/bag
-- Sourcing TBD: ask David where and how it is purchased
-- No market screen CONFIG entry yet — add once sourcing is confirmed

INSERT INTO products (id, name, category, unit, retail_price, wholesale_price, purchase_cost,
                      price_multiplier, margin_floor, case_size, is_active)
VALUES (
  gen_random_uuid(),
  'Potato (Ready Peeled)',
  'veg',
  'bag',
  191,   -- £1.91/bag (BCR Sem sell price, used as retail until sourcing known)
  191,
  0,     -- purchase cost unknown until sourcing confirmed
  2.00,
  0.20,
  1,
  true
)
ON CONFLICT DO NOTHING;

-- Backfill BCR Sem ready peeled orders now that product exists
DO $$
DECLARE
  cid  uuid := '11111111-1111-1111-1111-000000000003';
  pid  uuid;
  oid  uuid;
BEGIN
  SELECT id INTO pid FROM products WHERE name = 'Potato (Ready Peeled)' LIMIT 1;

  -- 05/03/2026 — 15 bags at £1.91
  SELECT wo.id INTO oid
  FROM wholesale_orders wo
  WHERE wo.customer_id = cid AND wo.order_date = '2026-03-05';

  IF oid IS NOT NULL THEN
    INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type)
    VALUES (oid, pid, 15, 191, 'retail_unit');
  END IF;

  -- 10/03/2026 — 60 bags at £1.91
  SELECT wo.id INTO oid
  FROM wholesale_orders wo
  WHERE wo.customer_id = cid AND wo.order_date = '2026-03-10';

  IF oid IS NOT NULL THEN
    INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type)
    VALUES (oid, pid, 60, 191, 'retail_unit');
  END IF;
END $$;
