-- 0114_baby_roast_potato_cost.sql
-- Q10: "Baby Roast potatoes ... This is Venezia mids. Supplied usually by Dole,
-- sometimes Baty or JR." Potato Baby Roast sells ~138 units/8wk at £2.25/kg but had
-- purchase_cost = 0. David confirms it's the same 10kg "MIDS" box that DOES appear on
-- recent invoices: Total Produce "POTATO MIDS WASHED 10KG" £7.50 and JR "MIDS - JAZZY"
-- £7.00 — i.e. ~75p/kg. Close the zero-cost hole.
-- (The fuller potato consolidation — merging Baby Roast / Mids / Venezia into one
-- product, and the wholesale 25kg-sack vs 10x2kg-prepack tidy-up — is still deferred.)
UPDATE products SET purchase_cost = 75
  WHERE name = 'Potato Baby Roast' AND purchase_cost = 0;
