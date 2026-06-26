-- 0119_product_market_section.sql
-- Make the market-run "Roots & Onions" grouping DATA-DRIVEN instead of a hardcoded
-- name list in the client (which silently dropped Onion Red/Spanish and any new root
-- veg). Each product now carries its own section; categorisation travels with the data.
--   market_section: 'roots' | 'veg' | 'fruit' | 'other'
-- Default = the product's category; then mark the roots/onions/tubers/alliums.
-- Ginger / turmeric / kohlrabi are deliberately NOT roots here — David files ginger
-- under "Exotic" in EPOS, so they stay on their category. Anything left unset just
-- falls back to its category, so nothing breaks.
ALTER TABLE products ADD COLUMN IF NOT EXISTS market_section text;

UPDATE products SET market_section = CASE
    WHEN category = 'fruit' THEN 'fruit'
    WHEN category = 'veg'   THEN 'veg'
    ELSE 'other' END
WHERE market_section IS NULL;

UPDATE products SET market_section = 'roots'
WHERE is_active AND (
     name ILIKE '%potato%'  OR name ILIKE '%onion%'    OR name ILIKE '%garlic%'
  OR name ILIKE '%carrot%'  OR name ILIKE '%leek%'     OR name ILIKE '%celeriac%'
  OR name ILIKE '%parsnip%' OR name ILIKE '%swede%'    OR name ILIKE '%turnip%'
  OR name ILIKE '%radish%'  OR name ILIKE '%beetroot%' OR name ILIKE '%shallot%'
  OR name ILIKE '%horseradish%' OR name ILIKE '%spring onion%' OR name ILIKE '%sweet pot%');
