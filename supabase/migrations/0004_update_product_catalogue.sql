-- ============================================================
-- Replace generic seed products with real specific varieties
-- Based on actual Dole Wholesale Gateshead invoice items
-- ============================================================

-- ── 1. Rename generic entries to correct names ──────────────
UPDATE products SET name = 'Apple Braeburn'      WHERE name = 'Apple (Braeburn)';
UPDATE products SET name = 'Grape Crimson'       WHERE name = 'Grapes (Red)';
UPDATE products SET name = 'Grape Thompson'      WHERE name = 'Grapes (White)';
UPDATE products SET name = 'Mushroom Closed Cup' WHERE name = 'Mushroom';
UPDATE products SET name = 'Orange Navel'        WHERE name = 'Orange';
UPDATE products SET name = 'Strawberry'          WHERE name = 'Strawberries';

-- ── 2. Deactivate over-generic entries (keep for audit trail) ─
UPDATE products SET is_active = false WHERE name IN ('Plum', 'Potato (Bag 2kg)');

-- ── 3. Add missing apple varieties ──────────────────────────
INSERT INTO products (name, category, unit, retail_price, wholesale_price, purchase_cost, price_multiplier, margin_floor) VALUES
  ('Apple Bramley',          'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Cox',              'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Cripps Pink',      'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Golden Delicious', 'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Granny Smith',     'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Pink Lady',        'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Red Delicious',    'fruit', 'each', 0, 0, 0, 2.00, 0.20),
  ('Apple Royal Gala',       'fruit', 'each', 0, 0, 0, 2.00, 0.20);

-- ── 4. Add missing fruit ─────────────────────────────────────
INSERT INTO products (name, category, unit, retail_price, wholesale_price, purchase_cost, price_multiplier, margin_floor) VALUES
  ('Apricot',             'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Blueberry',           'fruit', 'punnet', 0, 0, 0, 2.00, 0.20),
  ('Clementine',          'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Grapefruit',          'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  -- Grape Crimson and Grape Thompson already exist (renamed from Grapes Red/White above)
  ('Melon Honeydew',      'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Nectarine',           'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Pear Conference',     'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Pear Forelle',        'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Plum Flavorfall',     'fruit', 'each',   0, 0, 0, 2.00, 0.20),
  ('Pomegranate',         'fruit', 'each',   0, 0, 0, 2.00, 0.20);

-- ── 5. Add missing veg ───────────────────────────────────────
INSERT INTO products (name, category, unit, retail_price, wholesale_price, purchase_cost, price_multiplier, margin_floor) VALUES
  ('Mushroom Flat',   'veg', 'punnet', 0, 0, 0, 2.00, 0.20),
  ('Pea',             'veg', 'bag',    0, 0, 0, 2.00, 0.20),
  ('Potato Baker',    'veg', 'each',   0, 0, 0, 2.00, 0.20),
  ('Potato Mids',     'veg', 'kg',     0, 0, 0, 2.00, 0.20),
  ('Potato Washed',   'veg', 'kg',     0, 0, 0, 2.00, 0.20),
  ('Tomato Cherry',   'veg', 'punnet', 0, 0, 0, 2.00, 0.20);

-- ── 6. Fix duplicate Grape Crimson/Thompson (already renamed above,
--       so skip insert if they already exist from the rename)
-- No-op: covered by the UPDATE in step 1
