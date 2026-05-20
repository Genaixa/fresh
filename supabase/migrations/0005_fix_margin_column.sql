-- numeric(5,4) only stores values up to 9.9999 (precision 5, scale 4 = 1 digit before decimal).
-- Some products have retail_price=0 and purchase_cost>0, computing margins > 1.0 on the old
-- retail price. Widen to numeric(8,4) to allow values up to 9999.9999.
ALTER TABLE price_suggestions
  ALTER COLUMN margin_percentage TYPE numeric(8,4);
