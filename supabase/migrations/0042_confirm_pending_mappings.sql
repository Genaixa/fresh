-- Bulk-confirm 26 pending supplier mappings (8 Jun 2026)
-- Remaining 8 skipped: no matching product in catalogue

-- ============================================================
-- SKIP — no matching product
-- ============================================================
UPDATE supplier_product_mappings SET status = 'skipped'
WHERE status = 'pending' AND raw_description IN (
  '',                                 -- blank line from invoice
  'BAGS PAPER . 10X10 . .',           -- paper bags, not produce
  'BLACK CURRANT . SPAIN 12X125G . .', -- not stocked
  'CRANBERRY . USA . 200G SPLIT',     -- not stocked
  'GOOSEBERRY . UK 8 . .',            -- not stocked
  'RAMBUTAN . THAILAND 2 1KG .',      -- not stocked
  'WHITE CURRANT . NL 12X125G . .',   -- not stocked
  'TAMARILLO - PP TAMARIND'           -- no tamarillo/tamarind product
);

-- ============================================================
-- CONFIRM — mapped to existing products
-- ============================================================

-- Blood orange 8 kg box → Orange Blood
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='e0c38b88-34f8-428e-9949-26d75a23f823', unit_type='weight', box_weight_kg=8
WHERE status='pending' AND raw_description='BLOOD ORANGE COCKATOO SPAIN 60 8KG .';

-- Holland courgettes (incomplete description) → Courgette 5 kg
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='e4be8932-840d-4a2f-81dd-340f834cfc6c', unit_type='weight', box_weight_kg=5
WHERE status='pending' AND raw_description='COURGETTES -' AND supplier_name='jr holland';

-- Dragon fruit 14 per 5 kg box → Dragon Fruit
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='b652b426-6068-4eba-82ac-2ffc78424d3a', unit_type='count', units_per_case=14, box_weight_kg=5
WHERE status='pending' AND raw_description='DRAGON FRUIT . IL 14 5KG .';

-- Greengage (green plum variety) 5 kg → Plum
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='fbb5becc-cca4-4122-a65b-4a447c5f926c', unit_type='weight', box_weight_kg=5
WHERE status='pending' AND raw_description='GREENGAGE . FRANCE . 5KG .';

-- White melon Honduras 7 per 14 kg → Melon Honeydew
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='ed61eae5-7212-4ab0-8b27-a0a267e3936b', unit_type='count', units_per_case=7, box_weight_kg=14
WHERE status='pending' AND raw_description='MELON WHITE HONDURAS 7 14KG .';

-- Holland potato mids 10 kg pink box → Potato Mids
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='a64175dd-856a-4534-918b-0f772e3d1025', unit_type='weight', box_weight_kg=10
WHERE status='pending' AND raw_description='MIDS - 10KG PINK BOX';

-- Chestnut mushroom tray 2.27 kg → Mushroom Regular
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='5d5fd9f2-5232-4eb5-9c12-7e6d58058849', unit_type='weight', box_weight_kg=2.27
WHERE status='pending' AND raw_description='MUSHROOM CHESTNUT PL . 2.27KG . BUTTON MUSHROOM';

-- Orange peppers (3 Holland variants) → Pepper (Orange)
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='81e4479c-dfaf-4d8b-8f7f-d63bade35e6b', unit_type='weight'
WHERE status='pending' AND raw_description IN (
  'ORANGE PEPPERS - DUTCH',
  'ORANGE PEPPERS - DUTCH MED',
  'ORANGE PEPPERS - UK BLACK BOX'
);

-- Century pear (Chinese variety) → Pear Chinese
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='11262918-0398-495f-b9b9-53a098408d98', unit_type='count'
WHERE status='pending' AND raw_description='PEARS CENTURY PEAR CN . . .';

-- Santa Maria pear Spain 4 kg → Pear Conference (closest)
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='be162566-2631-4c69-98cb-a003a193a8de', unit_type='weight', box_weight_kg=4
WHERE status='pending' AND raw_description='PEARS SANTA MARIA SPAIN 16 4KG .';

-- Ya pear China 10 kg → Pear Chinese
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='11262918-0398-495f-b9b9-53a098408d98', unit_type='weight', box_weight_kg=10
WHERE status='pending' AND raw_description='PEARS YA CHINA . 10KG .';

-- Sweet bite peppers 3 kg → Pepper (Mixed)
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='cd6a5b06-81e9-4703-8a08-baeb6a504439', unit_type='weight', box_weight_kg=3
WHERE status='pending' AND raw_description='PEPPER SWEET BITE UK . 3KG .';

-- Sweet crunchy peppers 2.5 kg → Pepper (Mixed)
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='cd6a5b06-81e9-4703-8a08-baeb6a504439', unit_type='weight', box_weight_kg=2.5
WHERE status='pending' AND raw_description='PEPPER SWEET CRUNCHY UK . 2.5KG .';

-- Physalis punnets (2 Holland spelling variants) → Physalis
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='a8df48f9-bbdc-4f25-b0b9-f329f9db2e26', unit_type='count', units_per_case=1
WHERE status='pending' AND raw_description IN (
  'PHYSALLIS - PUNNETS',
  'PHYSALLIS - PUNNNETS'
);

-- Radish pre-packed x20 (3 Holland description variants) → Radish
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='ccf693c0-8893-4258-a09b-78eb3a4f51ca', unit_type='count', units_per_case=20
WHERE status='pending' AND raw_description IN (
  'RADISH PRE PACKED - DUTCH X20',
  'RADISH PRE PACKED - X20',
  'RADISH PRE PACKED - X20 DUTCH'
);

-- Redcurrants (4 Total Produce variants) → Redcurrant
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='b4b3cc92-9e07-4b2d-8ad6-c14cbd70c4a0', unit_type='weight', box_weight_kg=1
WHERE status='pending' AND raw_description='RED CURRANT . NETHERLANDS 12 1KG .';

UPDATE supplier_product_mappings SET status='confirmed',
  product_id='b4b3cc92-9e07-4b2d-8ad6-c14cbd70c4a0', unit_type='count', units_per_case=12
WHERE status='pending' AND raw_description='RED CURRANT . NETHERLANDS 12X125G . .';

UPDATE supplier_product_mappings SET status='confirmed',
  product_id='b4b3cc92-9e07-4b2d-8ad6-c14cbd70c4a0', unit_type='weight', box_weight_kg=2
WHERE status='pending' AND raw_description='RED CURRANT . SPAIN 12 2KG PUNNET';

UPDATE supplier_product_mappings SET status='confirmed',
  product_id='b4b3cc92-9e07-4b2d-8ad6-c14cbd70c4a0', unit_type='count', units_per_case=8
WHERE status='pending' AND raw_description='RED CURRANT . SPAIN 8X125G 1KG .';

-- Mixed squash 10 kg → Butternut Squash (closest match)
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='31b54cad-4d38-4cb1-b9d6-091deacd53b3', unit_type='weight', box_weight_kg=10
WHERE status='pending' AND raw_description='SQUASH MIXED UK . 10KG BOXED';

-- Yellow vine tomatoes 5 kg → Tomato
UPDATE supplier_product_mappings SET status='confirmed',
  product_id='f1ecc381-a61e-4c97-b231-b34133f7d69d', unit_type='weight', box_weight_kg=5
WHERE status='pending' AND raw_description='TOMATO VINE YELLOW NETHERLANDS . 5KG .';
