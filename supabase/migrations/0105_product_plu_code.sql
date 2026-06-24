-- 0105_product_plu_code.sql
-- Weigh-by-label scan path: a legal-for-trade scale weighs produce and prints a
-- price/weight-embedded EAN-13 label whose PLU field identifies the product.
-- This adds the PLU↔product link the till uses to resolve a scanned label.
--
-- PLU is the numeric "price look-up" code the operator assigns to each weighed
-- line on the scale; it is embedded in the label barcode (see src/lib/scale-barcode.ts).
-- Nullable: only weighed/scale products need one. Unique when set so a scanned
-- PLU resolves to exactly one product.

ALTER TABLE products ADD COLUMN IF NOT EXISTS plu_code integer;

CREATE UNIQUE INDEX IF NOT EXISTS products_plu_code_key
  ON products (plu_code) WHERE plu_code IS NOT NULL;

COMMENT ON COLUMN products.plu_code IS
  'Scale PLU embedded in weigh-by-label barcodes; resolves a scanned label to this product. Null = not sold by scale label.';
