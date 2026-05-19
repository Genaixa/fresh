-- ============================================================
-- Fresh & Fruity — Development Seed Data
-- Prices in pence (e.g. 40 = 40p, 150 = £1.50)
-- ============================================================

-- Suppliers
insert into suppliers (id, name, market_order, is_active) values
  ('11111111-0000-0000-0000-000000000001', 'Newcastle Fruit Market', 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Gateshead Wholesale', 2, true);

-- Products (representative catalogue for greengrocer)
-- Columns: name, category, unit, retail_price, wholesale_price, purchase_cost,
--          price_multiplier, market_ceiling, margin_floor
-- wholesale_price = 0 means not yet set (owner sets it per customer later)
insert into products
  (name, category, unit, retail_price, wholesale_price, purchase_cost,
   price_multiplier, market_ceiling, margin_floor)
values
  -- Fruit
  ('Lemon',           'fruit', 'each',   40,  0, 18, 2.00, 40,   0.20),
  ('Orange',          'fruit', 'each',   60,  0, 28, 2.00, NULL, 0.20),
  ('Apple (Braeburn)','fruit', 'each',   55,  0, 24, 2.00, NULL, 0.20),
  ('Banana',          'fruit', 'each',   30,  0, 12, 2.00, NULL, 0.20),
  ('Mango',           'fruit', 'each',   150, 0, 65, 2.00, NULL, 0.20),
  ('Pineapple',       'fruit', 'each',   180, 0, 80, 2.00, NULL, 0.20),
  ('Strawberries',    'fruit', 'punnet', 150, 0, 65, 2.00, NULL, 0.20),
  ('Grapes (White)',  'fruit', 'bag',    200, 0, 90, 2.00, NULL, 0.20),
  ('Grapes (Red)',    'fruit', 'bag',    200, 0, 90, 2.00, NULL, 0.20),
  ('Watermelon',      'fruit', 'each',   350, 0, 160, 2.00, NULL, 0.20),
  ('Lime',            'fruit', 'each',   40,  0, 15, 2.00, NULL, 0.20),
  ('Kiwi',            'fruit', 'each',   50,  0, 22, 2.00, NULL, 0.20),
  ('Peach',           'fruit', 'each',   80,  0, 35, 2.00, NULL, 0.20),
  ('Plum',            'fruit', 'each',   60,  0, 25, 2.00, NULL, 0.20),
  ('Avocado',         'fruit', 'each',   120, 0, 55, 2.00, NULL, 0.20),

  -- Veg
  ('Potato (Bag 2kg)','veg', 'bag',  150, 0, 60, 2.00, NULL, 0.20),
  ('Onion',           'veg', 'each',  30, 0, 12, 2.00, NULL, 0.20),
  ('Tomato',          'veg', 'each',  40, 0, 18, 2.00, 45,   0.20),
  ('Cucumber',        'veg', 'each',  60, 0, 25, 2.00, NULL, 0.20),
  ('Pepper (Red)',    'veg', 'each',  70, 0, 30, 2.00, NULL, 0.20),
  ('Pepper (Green)',  'veg', 'each',  50, 0, 20, 2.00, NULL, 0.20),
  ('Pepper (Yellow)', 'veg', 'each',  70, 0, 30, 2.00, NULL, 0.20),
  ('Courgette',       'veg', 'each',  60, 0, 25, 2.00, NULL, 0.20),
  ('Aubergine',       'veg', 'each',  90, 0, 40, 2.00, NULL, 0.20),
  ('Carrot',          'veg', 'each',  25, 0, 10, 2.00, NULL, 0.20),
  ('Broccoli',        'veg', 'each', 100, 0, 45, 2.00, NULL, 0.20),
  ('Cauliflower',     'veg', 'each', 120, 0, 55, 2.00, NULL, 0.20),
  ('Spinach',         'veg', 'bag',   90, 0, 40, 2.00, NULL, 0.20),
  ('Mushroom',        'veg', 'punnet',120, 0, 55, 2.00, NULL, 0.20),
  ('Garlic',          'veg', 'each',  40, 0, 15, 2.00, NULL, 0.20),
  ('Ginger',          'veg', 'each',  50, 0, 20, 2.00, NULL, 0.20),
  ('Sweet Potato',    'veg', 'each',  60, 0, 25, 2.00, NULL, 0.20),
  ('Butternut Squash','veg', 'each', 150, 0, 65, 2.00, NULL, 0.20),
  ('Celery',          'veg', 'each', 100, 0, 45, 2.00, NULL, 0.20),
  ('Leek',            'veg', 'each',  70, 0, 30, 2.00, NULL, 0.20),
  ('Spring Onion',    'veg', 'bunch', 60, 0, 25, 2.00, NULL, 0.20),
  ('Chilli (Red)',    'veg', 'each',  30, 0, 12, 2.00, NULL, 0.20);
