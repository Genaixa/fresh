-- 0124: Dole/Total Produce leek tickets print "5KG" but a leek box is ALWAYS really
-- 4.5kg (David-confirmed, see box/pack specs). The wrong 5kg made the market-run
-- cross-supplier per-unit compare invent an 11% "Dole cheaper than Holland" (140p/kg
-- vs 156p/kg) when both are actually 156p/kg. Correct the divisor at source so every
-- per-kg derivation (market-run + cost views) uses the true weight.
update purchase_invoice_items pii
set box_weight_kg = 4.5
from purchase_invoices pi, products p
where pii.invoice_id = pi.id
  and pii.product_id = p.id
  and p.name = 'Leek'
  and lower(pi.supplier_name) in ('dole wholesale gateshead','total produce')
  and pii.box_weight_kg = 5
  and pii.unit_type = 'weight';
