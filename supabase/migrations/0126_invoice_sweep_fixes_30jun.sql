-- 0126: durability + data fixes from the 30 Jun invoice sweep.
-- Pairs with the mapping-golem.ts guard (it now SKIPS pending/skipped keys), so the
-- re-detach in (A) finally sticks instead of being re-confirmed at the 10:00 run.

-- (A) "CARROTS - BABY PRE PACKS" — the 10:00 golem re-confirmed it onto Carrot Loose by
--     core-noun match (0125 was reverted). Re-detach to pending; the new guard protects it.
update supplier_product_mappings
set product_id = null, status = 'pending', updated_at = now()
where lower(supplier_name) = 'jr holland' and raw_description = 'CARROTS - BABY PRE PACKS';
update purchase_invoice_items
set product_id = null, is_matched = false
where product_name_raw = 'CARROTS - BABY PRE PACKS';

-- (B) Gooseberry "12 500G": tagged weight/0.5kg → an absurd £54/kg. Its sibling
--     "GOOSEBERRY UK 10X300G" is count, so 12 punnets → count/12 = £2.25/punnet. Fix both.
update supplier_product_mappings
set unit_type='count', units_per_case=12, box_weight_kg=null, updated_at=now()
where lower(supplier_name)='total produce' and raw_description='GOOSEBERRY. UK 12 500G.';
update purchase_invoice_items
set unit_type='count', units_per_case=12, box_weight_kg=null
where product_name_raw='GOOSEBERRY. UK 12 500G.';

-- (C) Sugar snap packets: the mapping is already count/1, but the ingested line drifted to
--     weight/5kg → bogus 22p/kg. Snap the line back to the mapping's basis (£1.10/packet).
update purchase_invoice_items
set unit_type='count', units_per_case=1, box_weight_kg=null
where product_name_raw='SUGAR SNAP PEAS - PACKETS';

-- (D) Yellow plum (was UNMATCHED): identical shape to the "PLUM SPLENDOR SPAIN 5KG" line
--     right above it → Plums Loose, weight/5kg. Obvious, costed now; flag if David disagrees.
update purchase_invoice_items
set product_id='72006aef-fabd-425e-bca7-439587c674b1', is_matched=true, unit_type='weight', box_weight_kg=5, units_per_case=null
where product_name_raw='PLUM YELLOW SPAIN. 5KG.';
insert into supplier_product_mappings
  (supplier_name, raw_description, normalised_description, product_id, status, unit_type, box_weight_kg, match_count, appearances)
values
  ('total produce','PLUM YELLOW SPAIN. 5KG.','PLUM YELLOW SPAIN 5KG','72006aef-fabd-425e-bca7-439587c674b1','confirmed','weight',5,1,1)
on conflict (supplier_name, normalised_description)
  do update set product_id=excluded.product_id, status='confirmed', unit_type='weight', box_weight_kg=5, updated_at=now();

-- (E) Queue the genuine David judgment calls surfaced by the sweep (mapping category, so the
--     auto-resolver leaves them for him). Carrot home + Poskitts box weight already logged (0125).
insert into david_questions (question, category, status, proposed_answer, evidence, dedup_key)
values
  ('Add a Pepper (Green) product? "GREEN PEPPER - DUTCH LGE" (£9.50) is unmatched and uncosted — you have Red/Yellow/Orange/Sweet but no Green.',
   'mapping','pending','Add Pepper (Green), priced alongside Red/Yellow.',
   '30 Jun inv 2750019: 1 x £9.50, currently unmatched.','map:jrholland:green-pepper'),
  ('How should babycorn map? "CORN ON THE COB - BOX BABYCORN X12" (£10.50) and "- SINGLE BABYCORN" (£1.00) are both unmatched — no babycorn/corn product exists.',
   'mapping','pending','Add a Babycorn product (box + single as two pack sizes).',
   '30 Jun inv 2750031: box £10.50 + single £1.00, both unmatched.','map:jrholland:babycorn'),
  ('"SWEET POTATOES - L1 FUTURE FARMS" (£7.00) is mapped to Potato Bag. Sweet potato is a different product — own SKU? (You confirmed sweet-potato 6kg earlier.)',
   'mapping','pending','Give sweet potato its own product, not Potato Bag.',
   '30 Jun inv 2750031: 4 x £7.00, currently → Potato Bag.','map:jrholland:sweet-potato'),
  ('Garlic: "RED NET LKL" (£27.00) and "P/P APOLLO X20" (£15.50) both map to Garlic Loose — very different items lumped together. Split into separate products?',
   'mapping','pending','Likely separate: a loose/net garlic vs a prepacked Apollo x20. Confirm.',
   '30 Jun inv 2750031: £27.00 net + £15.50 Apollo x20, both → Garlic Loose.','map:jrholland:garlic-loose-split');
