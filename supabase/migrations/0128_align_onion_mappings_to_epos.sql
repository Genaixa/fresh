-- 0128: align onion COST mappings to David's EPOS taxonomy (his source of truth).
-- EPOS separates "Onions SPANISH" (£1.80/kg, the big sweet ones) from "Onions" (£1.35/kg,
-- regular/brown incl. Dutch). Our products already mirror that (Onion Spanish £1.80 epos
-- 45126940; Onion Regular £1.35 epos 4590130) but several supplier lines were mis-filed:
-- Spanish onions sat under Regular and a Dutch + a Chilean onion sat under Spanish.

-- Spanish supplier lines → Onion Spanish (were wrongly in Onion Regular).
update supplier_product_mappings set product_id='65db7885-df5d-4330-99d1-959c433f6fd5', updated_at=now()
where lower(supplier_name)='dole wholesale gateshead'
  and raw_description in ('ONION . SPAIN . 20KG .','ONION . SPAIN 1 20KG .');
update purchase_invoice_items set product_id='65db7885-df5d-4330-99d1-959c433f6fd5'
where product_name_raw in ('ONION . SPAIN . 20KG .','ONION . SPAIN 1 20KG .');

-- Dutch + Chilean (regular/brown onions) → Onion Regular (were wrongly in Onion Spanish).
update supplier_product_mappings set product_id='14e6deff-e2c6-4cc2-a7f3-9239b079260e', updated_at=now()
where lower(supplier_name)='jr holland'
  and raw_description in ('DUTCH ONION - 24 KILO DUTCH','CHILEAN - SIZE 1');
update purchase_invoice_items set product_id='14e6deff-e2c6-4cc2-a7f3-9239b079260e'
where product_name_raw in ('DUTCH ONION - 24 KILO DUTCH','CHILEAN - SIZE 1');

-- NB deliberately NOT touched: "ONION . SPAIN . . PREPACKED" (Dole, prepacked — could be
-- Onion Spanish or Onion Prepacked, ambiguous) and the dead "Red Onion" duplicate product
-- (no EPOS link, dup of Onion Red). Both flagged for a human, not guessed here.
