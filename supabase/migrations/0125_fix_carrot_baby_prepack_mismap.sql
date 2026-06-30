-- 0125: "CARROTS - BABY PRE PACKS" (JR Holland, ~£2.00 a small retail prepack) was
-- mis-mapped to **Carrot Loose** and then divided by an assumed 5kg box, inventing a
-- bogus "40p/kg ▼ cheaper" winner in the market-run "cheapest per unit today" panel —
-- when real loose carrots are a steady ~70p/kg (£6.50–£7.00 per 10kg box). Same class
-- of bug as 0124 (leek box weight): a wrong spec faking a price move.
--
-- Baby prepacks are NOT loose carrots. Detach the mapping AND the already-ingested
-- 30 Jun invoice line so they stop polluting the Carrot Loose buying signal. Where baby
-- prepacks should ultimately live (Carrot Prepack vs a dedicated Baby Carrot product) is
-- a David taxonomy call, queued in david_questions below — do NOT guess a new home here.

-- 1. Detach the mapping (back to pending, unlinked) so future invoices re-route correctly.
update supplier_product_mappings
set product_id = null, status = 'pending', updated_at = now()
where lower(supplier_name) = 'jr holland'
  and raw_description = 'CARROTS - BABY PRE PACKS';

-- 2. Unlink the already-ingested 30 Jun line (invoice 2750031) from Carrot Loose.
update purchase_invoice_items
set product_id = null, is_matched = false
where product_name_raw = 'CARROTS - BABY PRE PACKS'
  and product_id = '69e73158-0fa9-4af1-8d95-b90122512e1d';

-- 3. Queue the two genuine David judgment calls (mapping home + Poskitts box weight).
insert into david_questions (question, category, status, proposed_answer, evidence, dedup_key)
values
  ('Where should "CARROTS - BABY PRE PACKS" (JR Holland, ~£2.00/pack) map? It is a small retail baby-carrot prepack, not loose carrots. Options: existing Carrot Prepack product, or a new Baby Carrot product.',
   'mapping', 'pending',
   'Map to Carrot Prepack (currently unused) unless you want baby carrots tracked separately.',
   '30 Jun inv 2750031: 4 x £2.00. Was mis-mapped to Carrot Loose, producing a fake 40p/kg in the market-run panel.',
   'map:jrholland:carrots-baby-pre-packs'),
  ('Confirm the box weight for "CARROTS - CLEAR POSKITTS" (JR Holland clear bag). The parser tagged it 5kg, which makes £6.50 read as £1.30/kg. Every other loose-carrot box is 10kg at ~£6.50 (=65p/kg).',
   'unit_basis', 'pending',
   '10kg box → 65p/kg (matches the rest of the loose-carrot history). The 5kg tag looks wrong.',
   '30 Jun inv 2750031 & 29 Jun 2749672: £6.50 each, tagged 5kg = 130p/kg vs the 70-75p/kg norm.',
   'spec:jrholland:carrots-clear-poskitts-boxwt');
