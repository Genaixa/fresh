-- Fix 47 unmatched invoice items by adding confirmed supplier mappings
-- and back-filling is_matched on existing purchase_invoice_items.
--
-- supplier_name values:
--   Total Produce → 'total produce'  (normaliseSupplierName('Total Produce'))
--   JR Holland   → 'jr holland'

-- ─── HELPER: upsert a mapping and back-fill matching invoice items ─────────────
-- We use individual INSERTs with ON CONFLICT so each is self-contained.

-- ════════════════════════════════════════════════════════════════
--  TOTAL PRODUCE
-- ════════════════════════════════════════════════════════════════

INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg)
VALUES
  ('total produce','MUSHROOM BUTTON PL . 2.27KG . BUTTON',       '7d48b88d-835e-446f-9c0b-fb18fd09f095','confirmed','weight',2.27),
  ('total produce','GRAPE SWEET GLOBE PE 10 0.5KG',              'df8d618e-d7da-4755-b47c-b89217b80d50','confirmed','count', NULL),
  ('total produce','GRAPEFRUIT STAR RUBY TURKEY 36 15KG',        'fd90e857-5390-4736-94ef-745d72d9e86f','confirmed','weight',15),
  ('total produce','GRAPE FLAME EG 10X500G 5KG PREPACKED',       'df8d618e-d7da-4755-b47c-b89217b80d50','confirmed','count', NULL),
  ('total produce','CARROT. CHINA. 10KG BOXED',                  '69e73158-0fa9-4af1-8d95-b90122512e1d','confirmed','weight',10),
  ('total produce','CARROT . CHINA . 10KG BOXED',                '69e73158-0fa9-4af1-8d95-b90122512e1d','confirmed','weight',10),
  ('total produce','MELON WATER SPAIN 4 16KG.',                  'c65565e5-cdec-447c-9197-87dd8ea0576d','confirmed','count', NULL),
  ('total produce','MELON WATER SPAIN 4 16KG . Poupart',         'c65565e5-cdec-447c-9197-87dd8ea0576d','confirmed','count', NULL),
  ('total produce','MUSHROOM CLOSED CUP POLAND 2.27KG.',         '5d5fd9f2-5232-4eb5-9c12-7e6d58058849','confirmed','weight',2.27),
  ('total produce','APPLE GOLDEN DELICIOUS FRANCE . 12KG . Venosta','cf2816c9-a004-4a85-b2d5-82664d9ae837','confirmed','weight',12),
  ('total produce','PLUM . ES 10X500G 5KG PREPACKED',            'b14acd54-6d55-4368-afb4-772a60542e84','confirmed','count', NULL),
  ('total produce','POTATO MIDS WASHED ES . 10KG',               'a64175dd-856a-4534-918b-0f772e3d1025','confirmed','weight',10),
  ('total produce','PAPAYA GREEN BR 5 9KG . Poupart',            'fcedb9db-6631-48cb-b785-0ae38d9b4cf9','confirmed','count', NULL),
  ('total produce','MANGO . BRAZIL 8 4KG . Pacific',             '35fac0b9-1ae9-4f97-b8eb-089b10f07ca4','confirmed','count', NULL),
  ('total produce','PINEAPPLE . COSTA RICA 8 10KG',              'e29d7739-a29f-48bd-bc07-3d6e7794f828','confirmed','count', NULL),
  ('total produce','POTATO . UK . 7.5KG CARRIER BAG',            'eed32eec-e866-4a2d-abc4-315d158f0a8c','confirmed','weight',7.5),
  ('total produce','SATSUMA . SPAIN 72 10KG . MALKI GOLD',       '3d4f1023-ca6a-413c-8018-384a605c4c42','confirmed','count', NULL),
  ('total produce','APPLE ROYAL GALA CHILE 78 12KG . Frusan',    'aa4c8f1e-92d0-4948-b630-1f3c29488bb0','confirmed','weight',12),
  ('total produce','PEARS CONFERENCE BELGIUM . 12KG . DOLE',     'be162566-2631-4c69-98cb-a003a193a8de','confirmed','weight',12),
  ('total produce','APPLE BRAMLEY UK 90/100 13KG . Kent',        '55b6a02c-33a1-4f36-b857-abff74aff428','confirmed','weight',13),
  ('total produce','APPLE PINK LADY FR . 4KG . TRAYS',           'db6af055-eda8-44ff-964d-c6aa60c27c9a','confirmed','weight',4),
  ('total produce','BANANA . COSTA RICA . 18KG . Chiquita',      'd85d0d21-166f-4fcb-967d-df877ee9b56a','confirmed','weight',18),
  ('total produce','APPLE GRANNY SMITH SPAIN . 13KG . Emporda',  '6ca074f2-d330-4d85-8ac6-831c4b51d081','confirmed','weight',13),
  ('total produce','BANANA . COSTA RICA . 13KG . DOLE',          'd85d0d21-166f-4fcb-967d-df877ee9b56a','confirmed','weight',13),
  ('total produce','PLUM RED BEAUTY SPAIN . 5KG . Dole',         '72006aef-fabd-425e-bca7-439587c674b1','confirmed','weight',5),
  ('total produce','KIWI . CL 27 4KG . FRUSAN RED BOX',          '9aaf97d9-8de5-4077-954d-e649f084c29b','confirmed','weight',4),
  ('total produce','APPLE ROYAL GALA UK 12X8 . PREPACKED Grower direct','aa4c8f1e-92d0-4948-b630-1f3c29488bb0','confirmed','count',NULL),
  ('total produce','PEACH . SPAIN 10X1KG 10KG PREPACKED Lison',  '1ed73c76-888b-42d0-a571-3a49fec5d926','confirmed','count', NULL),
  ('total produce','APRICOT . SPAIN 10X500G 5KG PACKED Black box','7fa9b02c-bf78-4c91-ae1c-1699e0514c9f','confirmed','count', NULL),
  ('total produce','STRAWBERRY . BELGIUM 8X500G . . HOOGSTRATEN','32322628-aca1-4280-8a83-8a4133546bbb','confirmed','count', NULL),
  ('total produce','NECTARINE . SPAIN 10X1KG . . Lison',         'e146b14f-795f-4229-8fad-1edc7b770ec7','confirmed','count', NULL),
  ('total produce','PEACH DONUT SPAIN 10X500G 5KG PREPACKED DISTINET','1ed73c76-888b-42d0-a571-3a49fec5d926','confirmed','count',NULL)
ON CONFLICT (supplier_name, raw_description)
DO UPDATE SET product_id = EXCLUDED.product_id, status = 'confirmed',
             unit_type = EXCLUDED.unit_type, box_weight_kg = EXCLUDED.box_weight_kg;

-- ════════════════════════════════════════════════════════════════
--  JR HOLLAND
-- ════════════════════════════════════════════════════════════════

INSERT INTO supplier_product_mappings (supplier_name, raw_description, product_id, status, unit_type, box_weight_kg, units_per_case)
VALUES
  ('jr holland','CHILEAN - SIZE 1',                 'cd6a5b06-81e9-4703-8a08-baeb6a504439','confirmed','count', NULL, NULL),
  ('jr holland','DUTCH ONION - 24 KILO DUTCH',      '65db7885-df5d-4330-99d1-959c433f6fd5','confirmed','weight',24,   NULL),
  ('jr holland','MUSHROOM - X12X250 GM PRE PACK',   'e670399d-e9f6-45c6-a04c-d1f242c8c4f0','confirmed','count', NULL, 12),
  ('jr holland','BAKERS 40 - 40S BAGS',             'eed32eec-e866-4a2d-abc4-315d158f0a8c','confirmed','count', NULL, 40),
  ('jr holland','ONIONS - PP X10 X1 KILO',          '395969a4-c8a0-4250-9c31-160b725e56f4','confirmed','count', NULL, 10),
  ('jr holland','SWEET POTATOES - GREENYA L1',      '1dcd2a92-3093-4328-a17f-6333249ef914','confirmed','weight',NULL, NULL),
  ('jr holland','PRE-PACKED POTATOES - 2KG PURPLE', '1cfd169b-2e29-4894-a642-2662762385b0','confirmed','count', NULL, NULL),
  ('jr holland','BUTTERNUT SQUASH - BLACK BOX X 10','31b54cad-4d38-4cb1-b9d6-091deacd53b3','confirmed','count', NULL, 10),
  ('jr holland','AVOCADOS - RTE GREY/BLACK BOX',    '8314af80-11a7-4d27-a9d1-ca00943886f5','confirmed','count', NULL, NULL),
  ('jr holland','RED SKIN - ROOSTER',               '55db2f78-68f0-497f-a985-b1595efebcb4','confirmed','weight',NULL, NULL),
  ('jr holland','PASSION FRUIT - BLACK BOX',        '2eb8b8b5-a035-41d3-9fa3-a62c54bb34f5','confirmed','count', NULL, NULL),
  ('jr holland','PHYSALLIS - PUNNETS',              'a8df48f9-bbdc-4f25-b0b9-f329f9db2e26','confirmed','count', NULL, NULL),
  ('jr holland','PEAS - PLASTIC BOX',               '38369a6b-442d-4a9f-aba5-099ad5d0370e','confirmed','weight',NULL, NULL),
  ('jr holland','PEAS - WOOD',                      '38369a6b-442d-4a9f-aba5-099ad5d0370e','confirmed','weight',NULL, NULL),
  ('jr holland','LEEKS - WOOD BOX',                 'cfac4e49-5427-4bf0-aa4f-64a137e49d23','confirmed','weight',NULL, NULL),
  ('jr holland','RED ONIONS - LEGEND',              '6f859222-21e6-4a42-b7a6-ab42e914d07a','confirmed','weight',NULL, NULL)
ON CONFLICT (supplier_name, raw_description)
DO UPDATE SET product_id = EXCLUDED.product_id, status = 'confirmed',
             unit_type = EXCLUDED.unit_type, box_weight_kg = EXCLUDED.box_weight_kg,
             units_per_case = EXCLUDED.units_per_case;

-- ════════════════════════════════════════════════════════════════
--  Back-fill existing unmatched purchase_invoice_items
-- ════════════════════════════════════════════════════════════════

UPDATE purchase_invoice_items pii
SET
  product_id = spm.product_id,
  is_matched = true,
  unit_type      = COALESCE(spm.unit_type, pii.unit_type),
  box_weight_kg  = COALESCE(spm.box_weight_kg, pii.box_weight_kg),
  units_per_case = COALESCE(spm.units_per_case, pii.units_per_case)
FROM supplier_product_mappings spm
JOIN purchase_invoices pi ON pi.id = pii.invoice_id
WHERE pii.is_matched = false
  AND pii.product_name_raw = spm.raw_description
  AND lower(regexp_replace(pi.supplier_name, '\s+', ' ', 'g')) = spm.supplier_name;
