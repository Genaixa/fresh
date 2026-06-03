-- Delivery invoices for 03/06/2026
-- Holland (Gateshead Wholesale) = supplier 11111111-0000-0000-0000-000000000002
-- Dole (Newcastle Fruit Market) = supplier 11111111-0000-0000-0000-000000000001

BEGIN;

-- ── Holland invoice 1 (£130.80) ───────────────────────────────────────────────
INSERT INTO purchase_invoices (id, supplier_id, supplier_name, invoice_date, total_amount, status)
VALUES (
  'aaaa0001-0603-2026-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  'JR Holland (Devorah Grynavs)',
  '2026-06-03',
  13080,
  'uploaded'
);

INSERT INTO purchase_invoice_items
  (invoice_id, product_name_raw, product_id, quantity, unit_cost, total_cost, unit_type, box_weight_kg)
VALUES
  -- 2 × CHILEAN AVOCADO SIZE 1 @ £13.00 each (18 per box → 72p each)
  ('aaaa0001-0603-2026-0000-000000000001', 'CHILEAN - SIZE 1',
    (SELECT id FROM products WHERE name = 'Avocado'), 2, 1300, 2600, 'count', NULL),
  -- 1 × DUTCH ONION 24KG @ £8.20 (34p/kg)
  ('aaaa0001-0603-2026-0000-000000000001', 'DUTCH ONION - 24 KILO DUTCH',
    (SELECT id FROM products WHERE name = 'Onion Regular'), 1, 820, 820, 'weight', 24),
  -- 1 × LEEKS WOOD BOX @ £7.20 (approx 5kg, 144p/kg)
  ('aaaa0001-0603-2026-0000-000000000001', 'LEEKS - WOOD BOX',
    (SELECT id FROM products WHERE name = 'Leek'), 1, 720, 720, 'weight', 5),
  -- 1 × RED SKIN ROOSTER @ £15.00 (approx 25kg sack, 60p/kg)
  ('aaaa0001-0603-2026-0000-000000000001', 'RED SKIN - ROOSTER',
    (SELECT id FROM products WHERE name = 'Potato'), 1, 1500, 1500, 'weight', 25),
  -- 1 × BAKERS 40 BAGS @ £6.50 (non-food)
  ('aaaa0001-0603-2026-0000-000000000001', 'BAKERS 40 - 40S BAGS',
    NULL, 1, 650, 650, 'count', NULL),
  -- 8 × PRE-PACKED POTATOES 2KG PURPLE @ £6.80 each
  ('aaaa0001-0603-2026-0000-000000000001', 'PRE-PACKED POTATOES - 2KG PURPLE',
    (SELECT id FROM products WHERE name = 'Potato (Bag 2kg)'), 8, 680, 5440, 'count', 2),
  -- 1 × PEAS PLASTIC BOX @ £13.50 (3kg, 450p/kg — under max 533p/kg)
  ('aaaa0001-0603-2026-0000-000000000001', 'PEAS - PLASTIC BOX',
    (SELECT id FROM products WHERE name = 'Pea'), 1, 1350, 1350, 'weight', 3);

-- ── Holland invoice 2 (£101.10) ───────────────────────────────────────────────
INSERT INTO purchase_invoices (id, supplier_id, supplier_name, invoice_date, total_amount, status)
VALUES (
  'aaaa0002-0603-2026-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  'JR Holland (Devorah Grynavs)',
  '2026-06-03',
  10110,
  'uploaded'
);

INSERT INTO purchase_invoice_items
  (invoice_id, product_name_raw, product_id, quantity, unit_cost, total_cost, unit_type, box_weight_kg)
VALUES
  -- 1 × BUTTERNUT SQUASH BLACK BOX X10 @ £8.50 (10 squash, 85p each)
  ('aaaa0002-0603-2026-0000-000000000001', 'BUTTERNUT SQUASH - BLACK BOX X 10',
    (SELECT id FROM products WHERE name = 'Butternut Squash'), 1, 850, 850, 'count', NULL),
  -- 4 × SWEET POTATOES GREENYA L1 @ £7.80 each (6kg box → 130p/kg → ~39p each of ~20)
  ('aaaa0002-0603-2026-0000-000000000001', 'SWEET POTATOES - GREENYA L1',
    (SELECT id FROM products WHERE name = 'Sweet Potato'), 4, 780, 3120, 'weight', 6),
  -- 2 × AVOCADOS RTE GREY/BLACK BOX @ £15.00 (18 per box → 83p each = AT MAX)
  ('aaaa0002-0603-2026-0000-000000000001', 'AVOCADOS - RTE GREY/BLACK BOX',
    (SELECT id FROM products WHERE name = 'Avocado'), 2, 1500, 3000, 'count', NULL),
  -- 2 × PASSION FRUIT BLACK BOX @ £13.50 (2kg, ~40 fruit → 33.75p each — OVER MAX £10/box)
  ('aaaa0002-0603-2026-0000-000000000001', 'PASSION FRUIT - BLACK BOX',
    (SELECT id FROM products WHERE name = 'Passion Fruit'), 2, 1350, 2700, 'weight', 2),
  -- 4 × PHYSALLIS PUNNETS @ £1.10 each
  ('aaaa0002-0603-2026-0000-000000000001', 'PHYSALLIS - PUNNETS',
    NULL, 4, 110, 440, 'count', NULL);

-- ── Dole invoice #11214714 (£479.50 + VAT £11.40) ────────────────────────────
INSERT INTO purchase_invoices (id, supplier_id, supplier_name, invoice_date, total_amount, status)
VALUES (
  'bbbb0001-0603-2026-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'Dole Wholesale Gateshead',
  '2026-06-03',
  49090,  -- total inc VAT
  'uploaded'
);

INSERT INTO purchase_invoice_items
  (invoice_id, product_name_raw, product_id, quantity, unit_cost, total_cost, unit_type, box_weight_kg, brand_raw)
VALUES
  -- 2 × CARROT CHINA 10KG @ £8.50 (85p/kg — NOTE: Chinese, not UK preferred)
  ('bbbb0001-0603-2026-0000-000000000001', 'CARROT . CHINA . 10KG BOXED',
    (SELECT id FROM products WHERE name = 'Carrot Loose'), 2, 850, 1700, 'weight', 10, 'Blue box'),
  -- 1 × POTATO MIDS WASHED 10KG @ £7.50 (75p/kg)
  ('bbbb0001-0603-2026-0000-000000000001', 'POTATO MIDS WASHED ES . 10KG',
    (SELECT id FROM products WHERE name = 'Potato Mids'), 1, 750, 750, 'weight', 10, 'vanisia'),
  -- 9 × APPLE PINK LADY FR 4KG @ £7.50 (187.5p/kg; ~25/box = 30p each)
  ('bbbb0001-0603-2026-0000-000000000001', 'APPLE PINK LADY FR . 4KG . TRAYS',
    (SELECT id FROM products WHERE name = 'Apple Pink Lady'), 9, 750, 6750, 'weight', 4, NULL),
  -- 10 × POTATO 7.5KG CARRIER BAG @ £2.20 (29p/kg)
  ('bbbb0001-0603-2026-0000-000000000001', 'POTATO . UK . 7.5KG CARRIER BAG',
    (SELECT id FROM products WHERE name = 'Potato'), 10, 220, 2200, 'weight', 8, 'Carry pots 7.5kg'),
  -- 2 × PLASTIC BAGS @ £19.50 each + £7.80 VAT
  ('bbbb0001-0603-2026-0000-000000000001', 'BAGS PLASTIC UK 10 . . MANGROVE CARRIER',
    NULL, 2, 1950, 3900, 'count', NULL, 'MANGROVE CARRIER'),
  -- 6 × WATER 24×500ML @ £3.00 each + £3.60 VAT
  ('bbbb0001-0603-2026-0000-000000000001', 'WATER STILL UK 24X500ML 12KG',
    (SELECT id FROM products WHERE name = 'Water Still 500ml'), 6, 300, 1800, 'count', NULL, 'Bottle water'),
  -- 2 × SATSUMA SPAIN 72 10KG @ £17.00 (170p/kg — note: unusual for June)
  ('bbbb0001-0603-2026-0000-000000000001', 'SATSUMA . SPAIN 72 10KG . MALKI GOLD',
    (SELECT id FROM products WHERE name = 'Satsuma'), 2, 1700, 3400, 'weight', 10, 'MALKI GOLD'),
  -- 1 × PLUM 10×500G 5KG PREPACKED @ £10.00 (200p/kg, 100p/punnet)
  ('bbbb0001-0603-2026-0000-000000000001', 'PLUM . ES 10X500G 5KG PREPACKED',
    (SELECT id FROM products WHERE name = 'Plums Loose'), 1, 1000, 1000, 'weight', 5, 'Icon'),
  -- 1 × PINEAPPLE 8pc @ £14.00 (175p each — AT max)
  ('bbbb0001-0603-2026-0000-000000000001', 'PINEAPPLE . COSTA RICA 8 10KG',
    (SELECT id FROM products WHERE name = 'Pineapple'), 1, 1400, 1400, 'count', NULL, NULL),
  -- 1 × PEARS CONFERENCE BELGIUM 12KG @ £19.00 (158p/kg, ~29p each)
  ('bbbb0001-0603-2026-0000-000000000001', 'PEARS CONFERENCE BELGIUM . 12KG . DOLE',
    (SELECT id FROM products WHERE name = 'Pear Conference'), 1, 1900, 1900, 'weight', 12, 'DOLE'),
  -- 1 × PAPAYA GREEN 5pc 9KG @ £7.00 (140p each)
  ('bbbb0001-0603-2026-0000-000000000001', 'PAPAYA GREEN BR 5 9KG . Poupart',
    (SELECT id FROM products WHERE name = 'Papaya'), 1, 700, 700, 'count', NULL, 'Poupart'),
  -- 2 × MELON WATER SPAIN 4pc 16KG @ £21.00 (525p each — OVER MAX 244p!)
  ('bbbb0001-0603-2026-0000-000000000001', 'MELON WATER SPAIN 4 16KG . Poupart',
    (SELECT id FROM products WHERE name = 'Watermelon'), 2, 2100, 4200, 'count', NULL, 'Poupart'),
  -- 6 × MANGO BRAZIL 8pc 4KG @ £5.00 (62.5p each — good buy under max 86p)
  ('bbbb0001-0603-2026-0000-000000000001', 'MANGO . BRAZIL 8 4KG . Pacific',
    (SELECT id FROM products WHERE name = 'Mango'), 6, 500, 3000, 'count', NULL, 'Pacific'),
  -- 3 × GRAPE FLAME EG 10×500G 5KG @ £18.00 (180p/punnet — AT max)
  ('bbbb0001-0603-2026-0000-000000000001', 'GRAPE FLAME EG 10X500G 5KG PREPACKED',
    (SELECT id FROM products WHERE name = 'Grapes'), 3, 1800, 5400, 'count', NULL, 'Tama'),
  -- 1 × BANANA 18KG Chiquita @ £18.50 (103p/kg — good, correct box)
  ('bbbb0001-0603-2026-0000-000000000001', 'BANANA . COSTA RICA . 18KG . Chiquita',
    (SELECT id FROM products WHERE name = 'Banana'), 1, 1850, 1850, 'weight', 18, 'Chiquita'),
  -- 1 × APPLE GOLDEN DELICIOUS FRANCE 12KG @ £18.00 (150p/kg)
  ('bbbb0001-0603-2026-0000-000000000001', 'APPLE GOLDEN DELICIOUS FRANCE . 12KG . Venosta',
    (SELECT id FROM products WHERE name = 'Apple Golden Delicious'), 1, 1800, 1800, 'weight', 12, 'Venosta'),
  -- 1 × APPLE ROYAL GALA CHILE 12KG @ £22.00 (183p/kg — OVER max 117p/kg; should be UK at £12)
  ('bbbb0001-0603-2026-0000-000000000001', 'APPLE ROYAL GALA CHILE 78 12KG . Frusan',
    (SELECT id FROM products WHERE name = 'Apple Royal Gala'), 1, 2200, 2200, 'weight', 12, 'Frusan'),
  -- 1 × APPLE BRAMLEY UK 13KG @ £22.00 (169p/kg)
  ('bbbb0001-0603-2026-0000-000000000001', 'APPLE BRAMLEY UK 90/100 13KG . Kent',
    (SELECT id FROM products WHERE name = 'Apple Bramley'), 1, 2200, 2200, 'weight', 13, 'Kent'),
  -- 1 × APPLE GRANNY SMITH SPAIN 13KG @ £18.00 (138p/kg — under max 154p/kg)
  ('bbbb0001-0603-2026-0000-000000000001', 'APPLE GRANNY SMITH SPAIN . 13KG . Emporda',
    (SELECT id FROM products WHERE name = 'Apple Granny Smith'), 1, 1800, 1800, 'weight', 13, 'Emporda');

-- ── Update purchase_cost (triggers price_history) ─────────────────────────────
-- Per-unit cost as used by pricing engine (pence per kg for weight, pence per item for count)

UPDATE products SET purchase_cost = 72  WHERE name = 'Avocado';          -- cheapest box today (Chilean)
UPDATE products SET purchase_cost = 85  WHERE name = 'Carrot Loose';
UPDATE products SET purchase_cost = 103 WHERE name = 'Banana';            -- per kg (18kg Chiquita)
UPDATE products SET purchase_cost = 170 WHERE name = 'Satsuma';           -- per kg
UPDATE products SET purchase_cost = 175 WHERE name = 'Pineapple';         -- per each (8 per box, £14)
UPDATE products SET purchase_cost = 158 WHERE name = 'Pear Conference';   -- per kg (12kg, £19)
UPDATE products SET purchase_cost = 140 WHERE name = 'Papaya';            -- per each (5 per 9kg, £7)
UPDATE products SET purchase_cost = 525 WHERE name = 'Watermelon';        -- per each (4 per 16kg, £21) — OVERPRICED
UPDATE products SET purchase_cost = 63  WHERE name = 'Mango';             -- per each (8 per 4kg, £5)
UPDATE products SET purchase_cost = 180 WHERE name = 'Grapes';            -- per punnet (10 per 5kg, £18)
UPDATE products SET purchase_cost = 150 WHERE name = 'Apple Golden Delicious'; -- per kg (12kg, £18)
UPDATE products SET purchase_cost = 183 WHERE name = 'Apple Royal Gala';  -- per kg (12kg, £22 — OVER)
UPDATE products SET purchase_cost = 138 WHERE name = 'Apple Granny Smith'; -- per kg (13kg, £18)
UPDATE products SET purchase_cost = 188 WHERE name = 'Apple Pink Lady';   -- per kg (4kg tray, £7.50)
UPDATE products SET purchase_cost = 34  WHERE name = 'Onion Regular';     -- per kg (24kg, £8.20)
UPDATE products SET purchase_cost = 144 WHERE name = 'Leek';              -- per kg (5kg wood box, £7.20)
UPDATE products SET purchase_cost = 85  WHERE name = 'Butternut Squash';  -- per each (10 per box, £8.50)
UPDATE products SET purchase_cost = 130 WHERE name = 'Sweet Potato';      -- per kg (6kg, £7.80)
UPDATE products SET purchase_cost = 675 WHERE name = 'Passion Fruit';     -- per kg (2kg, £13.50 — OVER MAX)
UPDATE products SET purchase_cost = 450 WHERE name = 'Pea';               -- per kg (3kg, £13.50)

COMMIT;
