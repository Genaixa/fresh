-- Add products identified from invoice gap analysis (315 OK invoices scanned)
-- Prices left at 0 for David to fill in via the pricing screen
-- epos_now_id left null — David assigns FF-064 onwards via EPOS Link Panel

INSERT INTO products (id, name, category, is_active, retail_price, wholesale_price, purchase_cost, case_size)
VALUES
  -- High-frequency missing fruit (100+ invoice appearances)
  (gen_random_uuid(), 'Passion Fruit',    'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Pomelo',           'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Satsuma',          'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Melon Cantaloupe', 'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Melon Galia',      'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Sharon Fruit',     'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Lychee',           'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Grape Sweet Globe','fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Tomato Vine',      'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Tomato Plum',      'veg',   true, 0, 0, 0, 1),

  -- Medium-frequency missing items (10–100 appearances)
  (gen_random_uuid(), 'Cherry',           'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Papaya',           'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Shallot',          'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Redcurrant',       'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Celeriac',         'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Kohlrabi',         'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Medjool Date',     'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Parsnip',          'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Red Cabbage',      'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Beetroot',         'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Marrow',           'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Salad Cress',      'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Fig',              'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Lettuce Cos',      'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Swede',            'veg',   true, 0, 0, 0, 1),

  -- Lower-frequency but clearly stocked items
  (gen_random_uuid(), 'Lettuce Iceberg',  'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Rhubarb',          'fruit', true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Cabbage White',    'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Chinese Leaves',   'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Hispi Cabbage',    'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Bean Fine',        'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Chicory',          'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Turnip',           'veg',   true, 0, 0, 0, 1),
  (gen_random_uuid(), 'Radish',           'veg',   true, 0, 0, 0, 1);
