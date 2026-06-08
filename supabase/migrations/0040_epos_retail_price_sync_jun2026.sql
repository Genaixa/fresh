-- EPOS retail price sync (8 Jun 2026)
-- Source: full EPOS Now price export provided by David
-- Rule: EPOS is authoritative for retail_price. DB costs unchanged.
-- Products already matching EPOS are omitted (✓ in comments below).

-- ============================================================
-- CORRECTIONS (DB had wrong or stale price)
-- ============================================================

-- Garlic Loose/Bulb: DB had 500p (clearly wrong). EPOS "Garlic Bulb" = 77p each.
UPDATE products SET retail_price = 77 WHERE name = 'Garlic Loose';

-- Garlic Prepack: EPOS "Garlic Pre-pack" = £2.40
UPDATE products SET retail_price = 240 WHERE name = 'Garlic Prepack';

-- Garlic Peeled Pack: EPOS "Garlic Peeled Pack (1KG)" = £6.90
UPDATE products SET retail_price = 690 WHERE name = 'Garlic Peeled Pack';

-- Ginger: DB had 50p (estimate). EPOS = £6.00
UPDATE products SET retail_price = 600 WHERE name = 'Ginger';

-- Strawberry: DB had 499p (our £4.99 recommendation). David set EPOS to £3.60 for Belgium punnet.
UPDATE products SET retail_price = 360 WHERE name = 'Strawberry';

-- Pear Conference: DB had 280p. EPOS "Pears Conference" = £2.99
UPDATE products SET retail_price = 299 WHERE name = 'Pear Conference';

-- Carrot Loose: DB had 100p/kg. EPOS "Carrots" = £1.25/kg
UPDATE products SET retail_price = 125 WHERE name = 'Carrot Loose';

-- ============================================================
-- FILLS (DB had 0 — now confirmed from EPOS)
-- ============================================================

-- Fruit
UPDATE products SET retail_price = 332 WHERE name = 'Apple Bramley';         -- EPOS "Apple Cooking" £3.32
UPDATE products SET retail_price = 299 WHERE name = 'Apple Red Delicious';   -- EPOS £2.99
UPDATE products SET retail_price = 250 WHERE name = 'Apricot Punnet';        -- EPOS "Apricot Punnet" £2.50
UPDATE products SET retail_price = 198 WHERE name = 'Beetroot';              -- EPOS "Beetroot Loose" £1.98
UPDATE products SET retail_price = 100 WHERE name = 'Coconut';               -- EPOS £1.00
UPDATE products SET retail_price = 200 WHERE name = 'Dragon Fruit';          -- EPOS £2.00
UPDATE products SET retail_price = 69  WHERE name = 'Fig';                   -- EPOS £0.69
UPDATE products SET retail_price = 139 WHERE name = 'Granadilla';            -- EPOS "Grandilo" £1.39
UPDATE products SET retail_price = 240 WHERE name = 'Grape Sweet Globe';     -- EPOS "Grapes Green Punnet" £2.40
UPDATE products SET retail_price = 299 WHERE name = 'Kiwi Prepack';          -- EPOS "Kiwi Punnet" £2.99
UPDATE products SET retail_price = 590 WHERE name = 'Lychee';                -- EPOS "Litchi" £5.90
UPDATE products SET retail_price = 400 WHERE name = 'Rhubarb';               -- EPOS £4.00
UPDATE products SET retail_price = 49  WHERE name = 'Sharon Fruit Loose';    -- EPOS "Sharon fruit" £0.49
UPDATE products SET retail_price = 350 WHERE name = 'Sharon Fruit Punnet';   -- EPOS "Sharon punnet" £3.50

-- Veg
UPDATE products SET retail_price = 169 WHERE name = 'Bean Fine';             -- EPOS "Fine Beans" £1.69
UPDATE products SET retail_price = 89  WHERE name = 'Bean Sprout';           -- EPOS "Bean Sprouts" £0.89
UPDATE products SET retail_price = 100 WHERE name = 'Carrot Prepack';        -- EPOS "Carrot Bag 1KG" £1.00
UPDATE products SET retail_price = 420 WHERE name = 'Kohlrabi';              -- EPOS £4.20
UPDATE products SET retail_price = 150 WHERE name = 'Marrow';                -- EPOS £1.50
UPDATE products SET retail_price = 190 WHERE name = 'Red Cabbage';           -- EPOS "Cabbage Red" £1.90
UPDATE products SET retail_price = 169 WHERE name = 'Sugarsnap';             -- EPOS "Sugar Snaps" £1.69
UPDATE products SET retail_price = 362 WHERE name = 'Turnip';                -- EPOS £3.62

-- Onions
UPDATE products SET retail_price = 135 WHERE name = 'Onion Red';             -- EPOS "Onion Red" £1.35
UPDATE products SET retail_price = 135 WHERE name = 'Red Onion';             -- same product, duplicate DB entry
UPDATE products SET retail_price = 180 WHERE name = 'Onion Spanish';         -- EPOS "Onions SPANISH" £1.80

-- Peppers
UPDATE products SET retail_price = 239 WHERE name = 'Pepper (Mixed)';        -- EPOS "Peppers Mixed Pack" £2.39

-- Citrus
UPDATE products SET retail_price = 29  WHERE name = 'Oranges Small';         -- EPOS "Orange Small" £0.29

-- Tangerine / Satsuma family
-- "Satsuma" DB = 330p matches EPOS "Tangerine Loose" £3.30 ✓
UPDATE products SET retail_price = 350 WHERE name = 'Tangerine (Punnet)';    -- EPOS "Tangerine PUNNET" £3.50

-- ============================================================
-- ALREADY CORRECT — no action needed (logged for audit)
-- ============================================================
-- Aubergine 380 ✓       Avocado 109 ✓         Banana 149 ✓
-- Blueberry 199 ✓       Butternut Squash 260 ✓  Cabbage White 100 ✓
-- Celery 120 ✓          Chinese Leaves 100 ✓    Courgette 380 ✓
-- Cucumber 69 ✓         Celeriac 299 ✓          Grapefruit 69 ✓
-- Grapes 220 ✓          Kiwi Loose 45 ✓         Leek 320 ✓
-- Lemon 40 ✓            Lettuce Cos 160 ✓       Lettuce Iceberg 115 ✓
-- Lime 43 ✓             Mango 150 ✓             Melon Cantaloupe 200 ✓
-- Melon Galia 250 ✓     Melon Honeydew 280 ✓    Melon Piel de Sapo 250 ✓
-- Mushroom Button 125 ✓ Mushroom Regular 458 ✓  Nectarine 299 ✓
-- Onion Regular 135 ✓   Onion Prepacked 135 ✓   Oranges Large 69 ✓
-- Papaya 399 ✓          Parsnip 280 ✓           Passion Fruit 39 ✓
-- Pea 700 ✓             Pepper (Red) 449 ✓      Pepper (Yellow) 449 ✓
-- Physalis 169 ✓        Pineapple 239 ✓         Plums Loose 360 ✓
-- Pomegranate 150 ✓     Potato (Bag 2kg) 140 ✓  Potato Loose 120 ✓
-- Radish 66 ✓           Salad Cress 44 ✓        Satsuma 330 ✓
-- Shallot 160 ✓         Starfruit 100 ✓         Swede 160 ✓
-- Sweet Potato 299 ✓    Tomato 480 ✓            Tomato Cherry 120 ✓
-- Tomato Cherry Vine 699 ✓  Watermelon 400 ✓   Apple Pink Lady 433 ✓
-- Apple Braeburn 299 ✓  Apple Golden 299 ✓      Apple Granny Smith 299 ✓
-- Apple Royal Gala 299 ✓  Pear Conference — updated above
