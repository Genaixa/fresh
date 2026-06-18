-- ═══════════════════════════════════════════════════════════════════════════════
-- 0092 — Map the obvious unmatched supplier lines (18 Jun audit, mapping backlog)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Clears the recurring "needs mapping" golem nag for items with an unambiguous
-- catalogue home. Each line is matched on its product AND given the correct unit
-- basis (so it doesn't recreate the per-case cost bug fixed in 0090/0091), and a
-- supplier mapping is added so future identical lines auto-match.
--
-- Bases follow how each item is SOLD (per the EPOS retail unit), verified against
-- existing confirmed mappings where one existed:
--   Tangerine, Onion(s), Plums Loose, Kohlrabi  → per kg  (weight / box_weight)
--   Grapes, Peppers, Gooseberry, Plums Punnet, Oranges → per pack/fruit (count)
--
-- LEFT for David (genuinely ambiguous — NOT guessed): "BAGS PLASTIC … MANGROVE
-- CARRIER" (packaging, no resale SKU), "CHILEAN - SIZE 2" (avocado? plum?),
-- "SPANISH X1 - ANGELA" (variety unclear), and the junk "- NO PACK SIZE" (qty 0).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Reusable: confirm a mapping (insert or repoint), lower-cased supplier name.
CREATE OR REPLACE FUNCTION _map(_sup text, _raw text, _pid uuid, _ut text, _upc int, _bw numeric)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO supplier_product_mappings
    (supplier_name, raw_description, product_id, unit_type, units_per_case, box_weight_kg, status, match_count, appearances)
  VALUES (_sup, _raw, _pid, _ut, _upc, _bw, 'confirmed', 1, 1)
  ON CONFLICT (supplier_name, raw_description)
  DO UPDATE SET product_id = EXCLUDED.product_id, unit_type = EXCLUDED.unit_type,
                units_per_case = EXCLUDED.units_per_case, box_weight_kg = EXCLUDED.box_weight_kg,
                status = 'confirmed';
$$;

-- Reusable: match the open invoice line(s) for a raw description with the right basis.
CREATE OR REPLACE FUNCTION _match(_raw text, _pid uuid, _ut text, _upc int, _bw numeric)
RETURNS void LANGUAGE sql AS $$
  UPDATE purchase_invoice_items
  SET product_id = _pid, is_matched = true, unit_type = _ut, units_per_case = _upc, box_weight_kg = _bw
  WHERE NOT is_matched AND product_name_raw = _raw;
$$;

-- ── Tangerine  (satsuma → Tangerine, David's 16 Jun call; sold per kg, 10kg box) ──
SELECT _match('SATSUMA. PERU 70 10KG.',  '3d4f1023-ca6a-413c-8018-384a605c4c42','weight',NULL,10);
SELECT _match('SATSUMA. SPAIN 72 10KG.', '3d4f1023-ca6a-413c-8018-384a605c4c42','weight',NULL,10);
SELECT _map('total produce','SATSUMA. PERU 70 10KG.', '3d4f1023-ca6a-413c-8018-384a605c4c42','weight',NULL,10);
SELECT _map('total produce','SATSUMA. SPAIN 72 10KG.','3d4f1023-ca6a-413c-8018-384a605c4c42','weight',NULL,10);

-- ── Grapes  (sold per 500g bag → count; loose 4.5kg = 9 bags, prepack 10x500g = 10) ──
SELECT _match('GRAPE FLAME EGYPT. 4.5KG.',                     'df8d618e-d7da-4755-b47c-b89217b80d50','count',9,NULL);
SELECT _match('GRAPE PRIME SEEDLESS EG 10X500G 5KG PREPACKED', 'df8d618e-d7da-4755-b47c-b89217b80d50','count',10,NULL);
SELECT _match('GRAPE SUGAR CRISP ES 10X500G 5KG PREPACKED',    'df8d618e-d7da-4755-b47c-b89217b80d50','count',10,NULL);
SELECT _map('total produce','GRAPE FLAME EGYPT. 4.5KG.',                     'df8d618e-d7da-4755-b47c-b89217b80d50','count',9,NULL);
SELECT _map('total produce','GRAPE PRIME SEEDLESS EG 10X500G 5KG PREPACKED', 'df8d618e-d7da-4755-b47c-b89217b80d50','count',10,NULL);
SELECT _map('total produce','GRAPE SUGAR CRISP ES 10X500G 5KG PREPACKED',    'df8d618e-d7da-4755-b47c-b89217b80d50','count',10,NULL);

-- Correct the 0090 loose-flame lines from weight/4.5kg to count/9 (per-bag, coherent
-- with the prepack lines — weight blended kg and bags in the cost view).
UPDATE purchase_invoice_items it SET unit_type='count', units_per_case=9, box_weight_kg=NULL
FROM products p WHERE it.product_id=p.id AND p.name='Grapes' AND it.is_matched
  AND it.unit_type='weight' AND it.product_name_raw ILIKE 'GRAPE FLAME%4.5KG%';
UPDATE supplier_product_mappings SET unit_type='count', units_per_case=9, box_weight_kg=NULL
WHERE raw_description ILIKE 'GRAPE FLAME EGYPT%4.5KG%' AND unit_type='weight';

-- ── Onions (20kg sacks, per kg). Spain → Onion Spanish; Chile → Onion Regular (convention) ──
SELECT _match('ONION. SPAIN 1 20KG,', '65db7885-df5d-4330-99d1-959c433f6fd5','weight',NULL,20);
SELECT _match('ONION. CHILE 1 20KG.', '14e6deff-e2c6-4cc2-a7f3-9239b079260e','weight',NULL,20);
SELECT _map('total produce','ONION. SPAIN 1 20KG,', '65db7885-df5d-4330-99d1-959c433f6fd5','weight',NULL,20);
SELECT _map('total produce','ONION. CHILE 1 20KG.', '14e6deff-e2c6-4cc2-a7f3-9239b079260e','weight',NULL,20);

-- ── Oranges (per fruit → count; grade number = fruit/box). Navel→Large, Valencia 80s→Small ──
SELECT _match('ORANGE NAVEL SPAIN 40 15KG.', 'bf7fd091-e669-447a-930c-ced5b1d40399','count',40,NULL);
SELECT _match('ORANGE VALENCIA EGYPT 80..',  'c4097681-b488-46c6-9ecc-34fb2cbeb066','count',80,NULL);
SELECT _map('total produce','ORANGE NAVEL SPAIN 40 15KG.', 'bf7fd091-e669-447a-930c-ced5b1d40399','count',40,NULL);
SELECT _map('total produce','ORANGE VALENCIA EGYPT 80..',  'c4097681-b488-46c6-9ecc-34fb2cbeb066','count',80,NULL);

-- ── Plums. Prepack 10x500g → Plums Punnet (count); loose 5kg → Plums Loose (per kg) ──
SELECT _match('PLUM SPLENDOR ES 10X500G 5KG PREPACKED', 'b14acd54-6d55-4368-afb4-772a60542e84','count',10,NULL);
SELECT _match('PLUM SPLENDOR SPAIN. 5KG.',              '72006aef-fabd-425e-bca7-439587c674b1','weight',NULL,5);
SELECT _map('total produce','PLUM SPLENDOR ES 10X500G 5KG PREPACKED', 'b14acd54-6d55-4368-afb4-772a60542e84','count',10,NULL);
SELECT _map('total produce','PLUM SPLENDOR SPAIN. 5KG.',              '72006aef-fabd-425e-bca7-439587c674b1','weight',NULL,5);

-- ── Peppers (Capsicum Mixed → Pepper (Mixed), count/10 per existing convention) ──
SELECT _match('CAPSICUM MIXED NETHERLANDS 10..', 'cd6a5b06-81e9-4703-8a08-baeb6a504439','count',10,NULL);
SELECT _map('total produce','CAPSICUM MIXED NETHERLANDS 10..', 'cd6a5b06-81e9-4703-8a08-baeb6a504439','count',10,NULL);

-- ── Gooseberry (10x300g → count/10). NB cost ~£2.50/punnet vs £2.49 shelf — thin, flag David ──
SELECT _match('GOOSEBERRIES - 10X300G', '496d0599-fe3b-470d-9b9d-c2d97985995f','count',10,NULL);
SELECT _map('jr holland','GOOSEBERRIES - 10X300G', '496d0599-fe3b-470d-9b9d-c2d97985995f','count',10,NULL);

-- ── Kohlrabi (KOHL RABI - BOX → Kohlrabi, weight/8kg per existing KOHLRABI-BOX mapping) ──
SELECT _match('KOHL RABI - BOX', '2909b1af-bfcf-45cb-80ed-c197d2a8e80f','weight',NULL,8);
SELECT _map('jr holland','KOHL RABI - BOX', '2909b1af-bfcf-45cb-80ed-c197d2a8e80f','weight',NULL,8);

DROP FUNCTION _map(text,text,uuid,text,int,numeric);
DROP FUNCTION _match(text,uuid,text,int,numeric);
