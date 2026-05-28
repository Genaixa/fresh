-- Store EPOS Now ProductID on imported sales rows so we can cross-reference
-- even when the product hasn't been linked to our products table yet.
ALTER TABLE sales_data ADD COLUMN IF NOT EXISTS epos_product_id text;
CREATE INDEX IF NOT EXISTS idx_sales_epos_id ON sales_data(epos_product_id);
