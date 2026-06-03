-- 0026: BCR Sem wholesale customer + March 2026 order history (partial — up to 12 Mar)
-- Email: accounts@bcrsem.org.uk · Contact: Z Sulzbacher
-- Total: £689.15 (first half of March, invoiced 15 Mar)
-- Skipped: ready peeled (not in catalogue), fruit (too generic),
--           chilli peppers (not in catalogue), leeks/lemons as retail units noted below

INSERT INTO wholesale_customers (id, name, email, contact_name, is_internal, is_active)
VALUES (
  '11111111-1111-1111-1111-000000000003',
  'BCR Sem', 'accounts@bcrsem.org.uk', 'Z Sulzbacher', false, true
)
ON CONFLICT (id) DO UPDATE SET
  name = 'BCR Sem', email = 'accounts@bcrsem.org.uk', contact_name = 'Z Sulzbacher';

DO $$
DECLARE
  cid        uuid := '11111111-1111-1111-1111-000000000003';
  oid        uuid;
  p_carrot   uuid := '69e73158-0fa9-4af1-8d95-b90122512e1d';
  p_parsnip  uuid := '4706bab8-b903-448b-8581-368dbb07356a';
  p_butternut uuid := '31b54cad-4d38-4cb1-b9d6-091deacd53b3';
  p_sweetpot uuid := '1dcd2a92-3093-4328-a17f-6333249ef914';
  p_cucumber uuid := '2af52c0b-c9cd-4b96-bed0-744a8240032c';
  p_rpep     uuid := 'e3e632c9-89f5-4e03-8b3d-010b6b9baf5c';
  p_mushroom uuid := '5d5fd9f2-5232-4eb5-9c12-7e6d58058849';
  p_potmids  uuid := 'a64175dd-856a-4534-918b-0f772e3d1025';
  p_courgette uuid := 'e4be8932-840d-4a2f-81dd-340f834cfc6c';
  p_leek     uuid := 'cfac4e49-5427-4bf0-aa4f-64a137e49d23';
  p_lemon    uuid := 'e2838162-83b6-41d9-85c2-d04f4f445967';
  p_garlic   uuid := 'bf3ad912-d591-498a-acf9-fb98f30fb4f5';
  p_banana   uuid := 'd85d0d21-166f-4fcb-967d-df877ee9b56a';
  p_grapes   uuid := 'df8d618e-d7da-4755-b47c-b89217b80d50';
  p_pineapple uuid := 'e29d7739-a29f-48bd-bc07-3d6e7794f828';
  p_auberg   uuid := '56f46a26-3c7e-41ce-ba00-dfbee7dcf626';
  p_tomato   uuid := 'f1ecc381-a61e-4c97-b231-b34133f7d69d';
  p_cherry   uuid := 'c414ebb1-1d91-46d8-afa3-3962b1d20cdb';
  p_avocado  uuid := '8314af80-11a7-4d27-a9d1-ca00943886f5';
  p_tangerine uuid := '3e03f4e8-2521-4bed-9e2a-a26bb507e8f3';
  p_apple    uuid := 'aa4c8f1e-92d0-4948-b630-1f3c29488bb0';
BEGIN

  -- 02/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-02', '2026-03-02', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot,    1,    810, 'box'),
    (oid, p_parsnip,   0.5,  600, 'box'),    -- half box at £6/box rate
    (oid, p_butternut, 1,   1200, 'box'),
    (oid, p_sweetpot,  1,   1150, 'box'),
    (oid, p_cucumber,  2,   1150, 'box'),
    (oid, p_rpep,      1,   1800, 'box'),    -- mixed peppers → Red Pepper
    (oid, p_mushroom,  2,    770, 'box');

  -- 05/03/2026
  -- leeks: 5 individual at £0.50 each; lemons: 10 individual at £0.45 each
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-05', '2026-03-05', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_potmids,   2,   1050, 'box'),    -- baby potatoes, £10.50/box
    (oid, p_rpep,      2,   1800, 'box'),
    (oid, p_courgette, 1,   1050, 'box'),
    (oid, p_leek,      5,     50, 'retail_unit'),  -- individual leeks 50p each
    (oid, p_parsnip,   0.5,  600, 'box'),
    (oid, p_lemon,    10,     45, 'retail_unit'),  -- individual lemons 45p each
    (oid, p_garlic,    1,    600, 'retail_unit'),
    (oid, p_banana,    1,   2250, 'box');

  -- 06/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-06', '2026-03-06', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_grapes,    1,   2000, 'box'),
    (oid, p_pineapple, 6,    180, 'retail_unit'),  -- individual pineapples £1.80 each
    (oid, p_auberg,    2,   1300, 'box');

  -- 10/03/2026 (ready peeled x60 and generic "fruit" skipped)
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-10', '2026-03-10', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_carrot,    2,    810, 'box'),
    (oid, p_sweetpot,  1,   1150, 'box'),
    (oid, p_butternut, 1,   1300, 'box');

  -- 11/03/2026 — "tang" = Tangerine, "apple" = Apple Royal Gala
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-11', '2026-03-11', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_cucumber,  1,    860, 'box'),
    (oid, p_tomato,    1,   1500, 'box'),
    (oid, p_rpep,      1,   1750, 'box'),
    (oid, p_tangerine, 1,   1800, 'box'),
    (oid, p_apple,     1,   2100, 'box');

  -- 12/03/2026
  INSERT INTO wholesale_orders (id, customer_id, order_date, delivery_date, status)
  VALUES (gen_random_uuid(), cid, '2026-03-12', '2026-03-12', 'dispatched') RETURNING id INTO oid;
  INSERT INTO wholesale_order_items (order_id, product_id, quantity, unit_price, unit_type) VALUES
    (oid, p_auberg,    2,   1200, 'box'),
    (oid, p_cherry,    2,    960, 'box'),
    (oid, p_garlic,    3,    600, 'retail_unit'),
    (oid, p_mushroom,  2,    770, 'box'),
    (oid, p_avocado,   2,   1910, 'box'),
    (oid, p_banana,    1,   2250, 'box');

END $$;
