-- 0102_product_epos_aliases.sql
-- Multi-button -> single product mapping.
--
-- Problem: EPOS Now has many buttons for one real product — multibuy/promo
-- buttons ("Passion Fruit 3 for £1") and duplicates ("mango2") each carry a
-- distinct ProductId. products.epos_now_id holds only ONE id per product, so
-- these sibling buttons go unattributed and fragment per-product sales.
--
-- Fix: an alias table mapping extra EPOS ProductIds -> the base product. Sales
-- attribution (api/sync/import-sales) consults epos_now_id first, then this
-- table. Additive and reversible — nothing existing changes.
--
-- Scope of THIS migration: only unambiguous RETAIL aliases. Excluded on purpose:
--   * wholesale buttons (… Box / Sack / Net / - MP / (N)) — different channel
--   * items blocked on David's decisions (strawberry merge, potato synonyms,
--     Pink Lady/Cripps duplicate, garlic peeled) — added later once confirmed
--   * uncatalogued buttons (drinks, nuts, kumquat) — need new PRODUCTS, not aliases

CREATE TABLE IF NOT EXISTS product_epos_aliases (
  epos_product_id text PRIMARY KEY,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_epos_aliases_product ON product_epos_aliases(product_id);

-- Insert helper semantics: only map a button if (a) its base product exists by
-- name and (b) the button isn't already some product's primary epos_now_id.
-- INSERT..SELECT makes a missing product a silent no-op rather than a bad row.
INSERT INTO product_epos_aliases (epos_product_id, product_id, note)
SELECT v.eid, p.id, v.note
FROM (VALUES
  -- promo / multibuy (retail) --------------------------------------------------
  ('46682933', 'Passion Fruit',  'Passion Fruit 3 for £1 (promo)'),
  ('46727281', 'Pomegranate',    'Pomegranate 2 for £1 (promo)'),
  ('49087054', 'Plum',           'Plum 4 for £1 (promo)'),
  ('52238263', 'Avocado',        'avocado 3 for £1 (promo)'),
  ('52238184', 'Avocado',        'avocado offer (promo)'),
  ('52255437', 'Courgette',      'courgettes 10 for £1 (promo)'),
  ('9912734',  'Milk',           'Milk Promotion 80p (promo)'),
  ('43128413', 'Milk',           'Milk Mp (promo)'),
  ('43512135', 'Milk',           'Milk Promotion (promo)'),
  -- exact duplicates (retail, same unit) ---------------------------------------
  ('52217185', 'Tomato Cherry',  'cherry tomato tub (duplicate button)'),
  ('52183532', 'Mango',          'mango2 (duplicate button)'),
  ('14155420', 'Dragon Fruit',   'Dragon fruit (duplicate button)'),
  ('4592060',  'Pomegranate',    'Pomegranate large (size variant)')
) AS v(eid, pname, note)
JOIN products p ON p.name = v.pname
WHERE NOT EXISTS (SELECT 1 FROM products px WHERE px.epos_now_id = v.eid)
ON CONFLICT (epos_product_id) DO NOTHING;

-- Backfill: re-attribute existing sales lines sitting on these alias buttons.
UPDATE sales_data s
SET product_id = a.product_id
FROM product_epos_aliases a
WHERE s.epos_product_id = a.epos_product_id
  AND s.product_id IS NULL;
