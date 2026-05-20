-- case_size: how many retail units are in a purchased box/case.
-- Used by the pricing engine: retail_price = (box_cost / case_size) * multiplier
-- Default 1 preserves existing behaviour for products not yet updated.
ALTER TABLE products
  ADD COLUMN case_size integer NOT NULL DEFAULT 1;

-- Store the parsed case size alongside each invoice line for audit purposes.
ALTER TABLE purchase_invoice_items
  ADD COLUMN units_per_case integer;
