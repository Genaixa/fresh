-- 0127: apply David's 30 Jun email reply to the 6 sweep questions + close the ledger.

-- 1+2. Green peppers & babycorn = wholesale special orders (not retail products).
--      Record a SKIPPED mapping so they're intentionally unmapped and the golem (which now
--      respects skipped) never tries to auto-map them. Invoice lines stay uncosted (correct).
insert into supplier_product_mappings (supplier_name, raw_description, normalised_description, product_id, status)
values
  ('jr holland','GREEN PEPPER - DUTCH LGE','GREEN PEPPER - DUTCH LGE',null,'skipped'),
  ('jr holland','CORN ON THE COB - BOX BABYCORN X 12','CORN ON THE COB - BOX BABYCORN X 12',null,'skipped'),
  ('jr holland','CORN ON THE COB - SINGLE BABYCORN','CORN ON THE COB - SINGLE BABYCORN',null,'skipped')
on conflict (supplier_name, normalised_description)
  do update set product_id=null, status='skipped', updated_at=now();

-- 3. Sweet potatoes are their own thing → remap from Potato Bag to the Sweet Potato product.
update supplier_product_mappings
set product_id='1dcd2a92-3093-4328-a17f-6333249ef914', status='confirmed', updated_at=now()
where lower(supplier_name)='jr holland' and raw_description='SWEET POTATOES - L1 FUTURE FARMS';
update purchase_invoice_items
set product_id='1dcd2a92-3093-4328-a17f-6333249ef914', is_matched=true
where product_name_raw='SWEET POTATOES - L1 FUTURE FARMS';

-- 4. Garlic: David confirms red-net and Apollo-x20 are two separate packs, both opened and
--    sold as single garlic → both correctly remain Garlic Loose. No data change needed.

-- 5. Baby carrot prepacks = special wholesale order → keep detached, mark skipped (was pending).
update supplier_product_mappings
set product_id=null, status='skipped', updated_at=now()
where lower(supplier_name)='jr holland' and raw_description='CARROTS - BABY PRE PACKS';

-- 6. Poskitts clear bag = 10kg of carrot sold loose → fix the box weight (was 5kg → 65p/kg).
update supplier_product_mappings
set unit_type='weight', box_weight_kg=10, units_per_case=null, status='confirmed', updated_at=now()
where lower(supplier_name)='jr holland' and raw_description='CARROTS - CLEAR POSKITTS';
update purchase_invoice_items
set unit_type='weight', box_weight_kg=10, units_per_case=null
where product_name_raw='CARROTS - CLEAR POSKITTS';

-- Close the six ledger questions with David's answers.
update david_questions set status='resolved', resolved_at=now(),
  answer=case dedup_key
    when 'map:jrholland:green-pepper' then 'Wholesale special order — not a retail product. Mapping skipped.'
    when 'map:jrholland:babycorn' then 'Wholesale special order — not retail products. Mappings skipped.'
    when 'map:jrholland:sweet-potato' then 'It is sweet potato → remapped to the Sweet Potato product (was Potato Bag).'
    when 'map:jrholland:garlic-loose-split' then 'Two separate packs (red net + Apollo x20), both opened and sold as single garlic → both stay Garlic Loose.'
    when 'map:jrholland:carrots-baby-pre-packs' then 'Special wholesale order — kept detached (skipped), not a retail line.'
    when 'spec:jrholland:carrots-clear-poskitts-boxwt' then 'Confirmed 10kg of carrot sold loose → box weight set to 10kg (65p/kg).'
  end
where dedup_key in ('map:jrholland:green-pepper','map:jrholland:babycorn','map:jrholland:sweet-potato',
  'map:jrholland:garlic-loose-split','map:jrholland:carrots-baby-pre-packs','spec:jrholland:carrots-clear-poskitts-boxwt');
