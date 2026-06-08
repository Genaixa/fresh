-- EPOS Now product ID linking (8 Jun 2026)
-- Source: 90-day + today's Sales by Product reports
-- Sets products.epos_now_id to match sales_data.epos_product_id
-- so the EPOS Compare page and future imports auto-link

-- ============================================================
-- 1. ADD MISSING PRODUCTS (in EPOS but not in DB)
-- ============================================================

INSERT INTO products (name, category, unit, retail_price, purchase_cost, is_active, case_size)
VALUES
  -- Horseradish: £1016 revenue in 90 days, significant product
  ('Horseradish', 'veg', 'each', 350, 0, true, 1),
  -- Tamarind: confirmed in EPOS at £2.99
  ('Tamarind', 'fruit', 'each', 299, 0, true, 1),
  -- Watermelon Large (4 per box): separate from 6s format
  ('Watermelon Large', 'fruit', 'each', 550, 500, true, 1),
  -- Strawberry Punnet (regular, 180p): distinct from Belgium at 360p
  ('Strawberry Punnet', 'fruit', 'punnet', 180, 0, true, 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. FIX RETAIL PRICES FOR ZERO-PRICED PRODUCTS NOW CONFIRMED
-- ============================================================

UPDATE products SET retail_price = 199 WHERE name = 'Apple Variety';    -- Pre Pack Apple £1.99
UPDATE products SET retail_price = 100 WHERE name = 'Chicory';           -- Chicory loose £1.00

-- ============================================================
-- 3. SET epos_now_id FOR ALL MATCHED PRODUCTS
-- ============================================================

-- Apples
UPDATE products SET epos_now_id = '2693455'  WHERE name = 'Apple Braeburn';
UPDATE products SET epos_now_id = '48180213' WHERE name = 'Apple Bramley';
UPDATE products SET epos_now_id = '2693458'  WHERE name = 'Apple Royal Gala';
UPDATE products SET epos_now_id = '2602093'  WHERE name = 'Apple Golden Delicious';
UPDATE products SET epos_now_id = '4577778'  WHERE name = 'Apple Granny Smith';
UPDATE products SET epos_now_id = '4577780'  WHERE name = 'Apple Pink Lady';
UPDATE products SET epos_now_id = '4577781'  WHERE name = 'Apple Red Delicious';
UPDATE products SET epos_now_id = '19247718' WHERE name = 'Apple Variety';

-- Soft fruit
UPDATE products SET epos_now_id = '46128454' WHERE name = 'Apricot';
UPDATE products SET epos_now_id = '47891356' WHERE name = 'Blueberry';
UPDATE products SET epos_now_id = '48466184' WHERE name = 'Strawberry';           -- Belgium punnet
UPDATE products SET epos_now_id = '4580443'  WHERE name = 'Strawberry Punnet';   -- regular 180p
UPDATE products SET epos_now_id = '4580440'  WHERE name = 'Plums Loose';
UPDATE products SET epos_now_id = '47399643' WHERE name = 'Plums Punnet';
UPDATE products SET epos_now_id = '4590151'  WHERE name = 'Rhubarb';

-- Citrus
UPDATE products SET epos_now_id = '4577783'  WHERE name = 'Grapefruit';
UPDATE products SET epos_now_id = '4577796'  WHERE name = 'Lemon';
UPDATE products SET epos_now_id = '9764517'  WHERE name = 'Lime';
UPDATE products SET epos_now_id = '4580428'  WHERE name = 'Oranges Large';
UPDATE products SET epos_now_id = '4580429'  WHERE name = 'Oranges Small';

-- Grapes
UPDATE products SET epos_now_id = '47592794' WHERE name = 'Grapes';              -- Closed punnet

-- Tropical / Exotic
UPDATE products SET epos_now_id = '2602077'  WHERE name = 'Avocado';
UPDATE products SET epos_now_id = '4577782'  WHERE name = 'Banana';
UPDATE products SET epos_now_id = '50214000' WHERE name = 'Coconut';
UPDATE products SET epos_now_id = '45702909' WHERE name = 'Ginger';
UPDATE products SET epos_now_id = '9620292'  WHERE name = 'Horseradish';
UPDATE products SET epos_now_id = '51130669' WHERE name = 'Jackfruit';
UPDATE products SET epos_now_id = '4577795'  WHERE name = 'Kiwi Loose';
UPDATE products SET epos_now_id = '46998788' WHERE name = 'Kiwi Prepack';
UPDATE products SET epos_now_id = '46181620' WHERE name = 'Lychee';
UPDATE products SET epos_now_id = '19997644' WHERE name = 'Mango';
UPDATE products SET epos_now_id = '4580431'  WHERE name = 'Passion Fruit';
UPDATE products SET epos_now_id = '47744198' WHERE name = 'Papaya';
UPDATE products SET epos_now_id = '4580438'  WHERE name = 'Pineapple';
UPDATE products SET epos_now_id = '51444342' WHERE name = 'Pomegranate';
UPDATE products SET epos_now_id = '50207600' WHERE name = 'Starfruit';
UPDATE products SET epos_now_id = '14068110' WHERE name = 'Tamarind';
UPDATE products SET epos_now_id = '4580444'  WHERE name = 'Satsuma';
UPDATE products SET epos_now_id = '47330567' WHERE name = 'Tangerine (Punnet)';
UPDATE products SET epos_now_id = '46128692' WHERE name = 'Dragon Fruit';

-- Dates
UPDATE products SET epos_now_id = '46691283' WHERE name = 'Medjool Date';

-- Stone fruit
UPDATE products SET epos_now_id = '4580433'  WHERE name = 'Peach';
UPDATE products SET epos_now_id = '46073190' WHERE name = 'Nectarine';

-- Pears
UPDATE products SET epos_now_id = '4580434'  WHERE name = 'Pear Conference';
UPDATE products SET epos_now_id = '46627206' WHERE name = 'Pear Conference (Punnet)';

-- Melons
UPDATE products SET epos_now_id = '4580418'  WHERE name = 'Melon Cantaloupe';
UPDATE products SET epos_now_id = '4580415'  WHERE name = 'Melon Galia';
UPDATE products SET epos_now_id = '7516789'  WHERE name = 'Melon Honeydew';
UPDATE products SET epos_now_id = '4580417'  WHERE name = 'Melon Piel de Sapo';
UPDATE products SET epos_now_id = '52173138' WHERE name = 'Watermelon';          -- 6s (small)
UPDATE products SET epos_now_id = '48921831' WHERE name = 'Watermelon Large';   -- 4s (large)

-- Tomatoes
UPDATE products SET epos_now_id = '4590157'  WHERE name = 'Tomato';             -- Loose/Vine combined
UPDATE products SET epos_now_id = '4590159'  WHERE name = 'Tomato Cherry';
UPDATE products SET epos_now_id = '48735462' WHERE name = 'Tomato Cherry Vine';
UPDATE products SET epos_now_id = '48935674' WHERE name = 'Tomato Plum';

-- Peppers
UPDATE products SET epos_now_id = '4590139'  WHERE name = 'Pepper (Red)';
UPDATE products SET epos_now_id = '4590141'  WHERE name = 'Pepper (Yellow)';
UPDATE products SET epos_now_id = '46085511' WHERE name = 'Pepper (Mixed)';

-- Salad veg
UPDATE products SET epos_now_id = '4590118'  WHERE name = 'Cucumber';
UPDATE products SET epos_now_id = '4590128'  WHERE name = 'Lettuce Iceberg';
UPDATE products SET epos_now_id = '14774910' WHERE name = 'Lettuce Cos';
UPDATE products SET epos_now_id = '7927245'  WHERE name = 'Chinese Leaves';
UPDATE products SET epos_now_id = '4590117'  WHERE name = 'Salad Cress';

-- Brassicas
UPDATE products SET epos_now_id = '4590101'  WHERE name = 'Cabbage White';
UPDATE products SET epos_now_id = '4590102'  WHERE name = 'Red Cabbage';
UPDATE products SET epos_now_id = '10757457' WHERE name = 'Hispi Cabbage';

-- Root veg
UPDATE products SET epos_now_id = '4590103'  WHERE name = 'Carrot Loose';
UPDATE products SET epos_now_id = '47064979' WHERE name = 'Carrot Prepack';
UPDATE products SET epos_now_id = '4590108'  WHERE name = 'Celeriac';
UPDATE products SET epos_now_id = '4590110'  WHERE name = 'Celery';
UPDATE products SET epos_now_id = '46621621' WHERE name = 'Beetroot';
UPDATE products SET epos_now_id = '4590125'  WHERE name = 'Leek';
UPDATE products SET epos_now_id = '4590132'  WHERE name = 'Parsnip';
UPDATE products SET epos_now_id = '4590150'  WHERE name = 'Radish';
UPDATE products SET epos_now_id = '4590152'  WHERE name = 'Swede';
UPDATE products SET epos_now_id = '50491835' WHERE name = 'Turnip';

-- Alliums
UPDATE products SET epos_now_id = '4590130'  WHERE name = 'Onion Regular';
UPDATE products SET epos_now_id = '4590131'  WHERE name = 'Onion Red';
UPDATE products SET epos_now_id = '45126940' WHERE name = 'Onion Spanish';
UPDATE products SET epos_now_id = '51541462' WHERE name = 'Onion Prepacked';
UPDATE products SET epos_now_id = '50336822' WHERE name = 'Garlic Loose';
UPDATE products SET epos_now_id = '46152000' WHERE name = 'Garlic Prepack';
UPDATE products SET epos_now_id = '46301462' WHERE name = 'Shallot';

-- Mushrooms
UPDATE products SET epos_now_id = '4590129'  WHERE name = 'Mushroom Regular';
UPDATE products SET epos_now_id = '46578422' WHERE name = 'Mushroom Button';

-- Potatoes
UPDATE products SET epos_now_id = '4590146'  WHERE name = 'Potato (Bag 2kg)';
UPDATE products SET epos_now_id = '46077562' WHERE name = 'Potato Loose';
UPDATE products SET epos_now_id = '48242178' WHERE name = 'Potato Baby';
UPDATE products SET epos_now_id = '7516871'  WHERE name = 'Potato (Ready Peeled)';
UPDATE products SET epos_now_id = '52169649' WHERE name = 'Potato Sack';

-- Other veg
UPDATE products SET epos_now_id = '46020023' WHERE name = 'Butternut Squash';
UPDATE products SET epos_now_id = '4590120'  WHERE name = 'Aubergine';
UPDATE products SET epos_now_id = '4590114'  WHERE name = 'Courgette';
UPDATE products SET epos_now_id = '4590164'  WHERE name = 'Bean Fine';
UPDATE products SET epos_now_id = '45840215' WHERE name = 'Bean Sprout';
UPDATE products SET epos_now_id = '9884793'  WHERE name = 'Chicory';
UPDATE products SET epos_now_id = '4590168'  WHERE name = 'Sugarsnap';
UPDATE products SET epos_now_id = '4590154'  WHERE name = 'Sweet Potato';
UPDATE products SET epos_now_id = '46030632' WHERE name = 'Kohlrabi';
UPDATE products SET epos_now_id = '9941569'  WHERE name = 'Sharon Fruit Loose';
UPDATE products SET epos_now_id = '48138712' WHERE name = 'Pea';
UPDATE products SET epos_now_id = '4590117'  WHERE name = 'Salad Cress';

-- Physalis
UPDATE products SET epos_now_id = '4580437'  WHERE name = 'Physalis';

-- Misc non-produce
UPDATE products SET epos_now_id = '50342025' WHERE name = 'Water Still 500ml';
UPDATE products SET epos_now_id = '4592058'  WHERE name = 'Milk';
