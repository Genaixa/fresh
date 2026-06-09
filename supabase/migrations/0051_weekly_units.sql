-- Real weekly unit sales from Epos Now — 3-period combined average
-- Period 1: 2025 full year (52 weeks)
-- Period 2: 01 Jan – 11 Mar 2026 (10 weeks)
-- Period 3: 12 Mar – 09 Jun 2026 (12.71 weeks)
-- Total: 74.71 weeks
-- Seasonal items (Lychee, Sharon Fruit, Strawberry) set at in-season peak rate

ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_units integer;
UPDATE products SET weekly_units = NULL;

UPDATE products SET weekly_units = 22  WHERE name = 'Apple Braeburn';
UPDATE products SET weekly_units = 9   WHERE name = 'Apple Golden Delicious';
UPDATE products SET weekly_units = 10  WHERE name = 'Apple Granny Smith';
UPDATE products SET weekly_units = 13  WHERE name = 'Apple Pink Lady';
UPDATE products SET weekly_units = 6   WHERE name = 'Apple Red Delicious';
UPDATE products SET weekly_units = 15  WHERE name = 'Apple Royal Gala';
UPDATE products SET weekly_units = 23  WHERE name = 'Aubergine';
UPDATE products SET weekly_units = 132 WHERE name = 'Avocado';
UPDATE products SET weekly_units = 71  WHERE name = 'Banana';
UPDATE products SET weekly_units = 8   WHERE name = 'Bean Fine';
UPDATE products SET weekly_units = 7   WHERE name = 'Beetroot';
UPDATE products SET weekly_units = 9   WHERE name = 'Blueberry';
UPDATE products SET weekly_units = 14  WHERE name = 'Butternut Squash';
UPDATE products SET weekly_units = 11  WHERE name = 'Cabbage White';
UPDATE products SET weekly_units = 76  WHERE name = 'Carrot Loose';
UPDATE products SET weekly_units = 35  WHERE name = 'Carrot Prepack';
UPDATE products SET weekly_units = 11  WHERE name = 'Celeriac';
UPDATE products SET weekly_units = 20  WHERE name = 'Celery';
UPDATE products SET weekly_units = 2   WHERE name = 'Cherry';
UPDATE products SET weekly_units = 12  WHERE name = 'Chilli (Red)';
UPDATE products SET weekly_units = 2   WHERE name = 'Chinese Leaves';
UPDATE products SET weekly_units = 54  WHERE name = 'Courgette';
UPDATE products SET weekly_units = 342 WHERE name = 'Cucumber';
UPDATE products SET weekly_units = 13  WHERE name = 'Medjool Date';
UPDATE products SET weekly_units = 1   WHERE name = 'Dragon Fruit';
UPDATE products SET weekly_units = 14  WHERE name = 'Garlic Loose';
UPDATE products SET weekly_units = 10  WHERE name = 'Garlic Prepack';
UPDATE products SET weekly_units = 1   WHERE name = 'Ginger';
UPDATE products SET weekly_units = 26  WHERE name = 'Grapefruit';
UPDATE products SET weekly_units = 68  WHERE name = 'Grapes';
UPDATE products SET weekly_units = 8   WHERE name = 'Horseradish';
UPDATE products SET weekly_units = 65  WHERE name = 'Kiwi Loose';
UPDATE products SET weekly_units = 16  WHERE name = 'Kohlrabi';
UPDATE products SET weekly_units = 21  WHERE name = 'Leek';
UPDATE products SET weekly_units = 56  WHERE name = 'Lemon';
UPDATE products SET weekly_units = 22  WHERE name = 'Lettuce Cos';
UPDATE products SET weekly_units = 13  WHERE name = 'Lettuce Iceberg';
UPDATE products SET weekly_units = 4   WHERE name = 'Lime';
UPDATE products SET weekly_units = 49  WHERE name = 'Lychee';          -- in-season peak (Jan-Mar)
UPDATE products SET weekly_units = 37  WHERE name = 'Mango';
UPDATE products SET weekly_units = 6   WHERE name = 'Melon Cantaloupe';
UPDATE products SET weekly_units = 6   WHERE name = 'Melon Galia';
UPDATE products SET weekly_units = 15  WHERE name = 'Melon Honeydew';
UPDATE products SET weekly_units = 14  WHERE name = 'Mushroom Button';
UPDATE products SET weekly_units = 14  WHERE name = 'Mushroom Regular';
UPDATE products SET weekly_units = 64  WHERE name = 'Mushroom Punnet';
UPDATE products SET weekly_units = 26  WHERE name = 'Nectarine';       -- loose; summer peak ~50/wk
UPDATE products SET weekly_units = 4   WHERE name = 'Orange Blood';    -- winter seasonal
UPDATE products SET weekly_units = 1   WHERE name = 'Onion Prepacked';
UPDATE products SET weekly_units = 17  WHERE name = 'Onion Red';
UPDATE products SET weekly_units = 17  WHERE name = 'Red Onion';
UPDATE products SET weekly_units = 85  WHERE name = 'Onion Regular';
UPDATE products SET weekly_units = 27  WHERE name = 'Onion Spanish';
UPDATE products SET weekly_units = 49  WHERE name = 'Oranges Large';
UPDATE products SET weekly_units = 70  WHERE name = 'Oranges Small';
UPDATE products SET weekly_units = 1   WHERE name = 'Papaya';
UPDATE products SET weekly_units = 21  WHERE name = 'Parsnip';
UPDATE products SET weekly_units = 48  WHERE name = 'Passion Fruit';
UPDATE products SET weekly_units = 4   WHERE name = 'Peach';           -- in-season (summer)
UPDATE products SET weekly_units = 29  WHERE name = 'Pear Conference';
UPDATE products SET weekly_units = 9   WHERE name = 'Pear Conference (Punnet)';
UPDATE products SET weekly_units = 9   WHERE name = 'Pea';
UPDATE products SET weekly_units = 10  WHERE name = 'Pepper (Mixed)';
UPDATE products SET weekly_units = 64  WHERE name = 'Pepper (Red)';
UPDATE products SET weekly_units = 10  WHERE name = 'Pepper (Yellow)';
UPDATE products SET weekly_units = 5   WHERE name = 'Physalis';
UPDATE products SET weekly_units = 16  WHERE name = 'Pineapple';
UPDATE products SET weekly_units = 23  WHERE name = 'Plums Loose';
UPDATE products SET weekly_units = 37  WHERE name = 'Pomegranate';
UPDATE products SET weekly_units = 16  WHERE name = 'Pomelo';
UPDATE products SET weekly_units = 2   WHERE name = 'Potato Bag';
UPDATE products SET weekly_units = 10  WHERE name = 'Potato Loose';
UPDATE products SET weekly_units = 24  WHERE name = 'Potato Baby';
UPDATE products SET weekly_units = 17  WHERE name = 'Potato Mids';
UPDATE products SET weekly_units = 4   WHERE name = 'Red Cabbage';
UPDATE products SET weekly_units = 1   WHERE name = 'Rhubarb';
UPDATE products SET weekly_units = 12  WHERE name = 'Salad Cress';
UPDATE products SET weekly_units = 55  WHERE name = 'Sharon Fruit Loose'; -- in-season peak (Nov-Feb)
UPDATE products SET weekly_units = 3   WHERE name = 'Shallot';
UPDATE products SET weekly_units = 23  WHERE name = 'Strawberry';      -- in-season peak (Jun-Aug)
UPDATE products SET weekly_units = 10  WHERE name = 'Sugarsnap';
UPDATE products SET weekly_units = 8   WHERE name = 'Swede';
UPDATE products SET weekly_units = 48  WHERE name = 'Sweet Potato';
UPDATE products SET weekly_units = 33  WHERE name = 'Tangerine';
UPDATE products SET weekly_units = 65  WHERE name = 'Tomato Cherry';
UPDATE products SET weekly_units = 4   WHERE name = 'Tomato Cherry Vine';
UPDATE products SET weekly_units = 30  WHERE name = 'Tomato';
UPDATE products SET weekly_units = 1   WHERE name = 'Turnip';
UPDATE products SET weekly_units = 10  WHERE name = 'Water Still 500ml';
UPDATE products SET weekly_units = 3   WHERE name = 'Watermelon';      -- summer seasonal
UPDATE products SET weekly_units = 1   WHERE name = 'Watermelon Large';

-- NOTE: 'Potato 2kg Bag' = 11,388 sold across all periods = 152/wk — not yet in products table
