-- Retail prices sourced from EPOS Now export (June 2026)
-- These are the per-unit prices charged to customers at the till.
-- Weight items with retailUnitsPerBox in config: price is per piece sold.
-- Items without retailUnitsPerBox still benefit from having retail_price
-- set for margin-alert calculations even though revenue uses price_multiplier fallback.

UPDATE products SET retail_price = 299 WHERE name = 'Apple Braeburn';
UPDATE products SET retail_price = 299 WHERE name = 'Apple Golden Delicious';
UPDATE products SET retail_price = 299 WHERE name = 'Apple Granny Smith';
UPDATE products SET retail_price = 433 WHERE name = 'Apple Pink Lady';
UPDATE products SET retail_price = 299 WHERE name = 'Apple Royal Gala';
UPDATE products SET retail_price = 250 WHERE name = 'Apricot';
UPDATE products SET retail_price = 380 WHERE name = 'Aubergine';
UPDATE products SET retail_price = 109 WHERE name = 'Avocado';
UPDATE products SET retail_price = 149 WHERE name = 'Banana';
UPDATE products SET retail_price = 199 WHERE name = 'Blueberry';
UPDATE products SET retail_price = 260 WHERE name = 'Butternut Squash';
UPDATE products SET retail_price = 100 WHERE name = 'Cabbage White';
UPDATE products SET retail_price = 299 WHERE name = 'Celeriac';
UPDATE products SET retail_price = 120 WHERE name = 'Celery';
UPDATE products SET retail_price = 100 WHERE name = 'Chinese Leaves';
UPDATE products SET retail_price = 380 WHERE name = 'Courgette';
UPDATE products SET retail_price = 69  WHERE name = 'Cucumber';
UPDATE products SET retail_price = 500 WHERE name = 'Garlic Loose';
UPDATE products SET retail_price = 69  WHERE name = 'Grapefruit';
UPDATE products SET retail_price = 269 WHERE name = 'Grapes';
UPDATE products SET retail_price = 45  WHERE name = 'Kiwi Loose';
UPDATE products SET retail_price = 320 WHERE name = 'Leek';
UPDATE products SET retail_price = 40  WHERE name = 'Lemon';
UPDATE products SET retail_price = 160 WHERE name = 'Lettuce Cos';
UPDATE products SET retail_price = 115 WHERE name = 'Lettuce Iceberg';
UPDATE products SET retail_price = 43  WHERE name = 'Lime';
UPDATE products SET retail_price = 150 WHERE name = 'Mango';
UPDATE products SET retail_price = 1480 WHERE name = 'Medjool Date';
UPDATE products SET retail_price = 200 WHERE name = 'Melon Cantaloupe';
UPDATE products SET retail_price = 250 WHERE name = 'Melon Galia';
UPDATE products SET retail_price = 280 WHERE name = 'Melon Honeydew';
UPDATE products SET retail_price = 250 WHERE name = 'Melon Piel de Sapo';
UPDATE products SET retail_price = 299 WHERE name = 'Nectarine';
UPDATE products SET retail_price = 69  WHERE name = 'Oranges Large';
UPDATE products SET retail_price = 399 WHERE name = 'Papaya';
UPDATE products SET retail_price = 39  WHERE name = 'Passion Fruit';
UPDATE products SET retail_price = 280 WHERE name = 'Pear Conference';
UPDATE products SET retail_price = 280 WHERE name = 'Pear Forelle';
UPDATE products SET retail_price = 239 WHERE name = 'Pineapple';
UPDATE products SET retail_price = 360 WHERE name = 'Plums Loose';
UPDATE products SET retail_price = 150 WHERE name = 'Pomegranate';
UPDATE products SET retail_price = 120 WHERE name = 'Potato';
UPDATE products SET retail_price = 120 WHERE name = 'Potato Loose';
UPDATE products SET retail_price = 66  WHERE name = 'Radish';
UPDATE products SET retail_price = 44  WHERE name = 'Salad Cress';
UPDATE products SET retail_price = 330 WHERE name = 'Satsuma';
UPDATE products SET retail_price = 160 WHERE name = 'Shallot';
UPDATE products SET retail_price = 100 WHERE name = 'Starfruit';
UPDATE products SET retail_price = 360 WHERE name = 'Strawberry';
UPDATE products SET retail_price = 160 WHERE name = 'Swede';
UPDATE products SET retail_price = 299 WHERE name = 'Sweet Potato';
UPDATE products SET retail_price = 480 WHERE name = 'Tomato';
UPDATE products SET retail_price = 120 WHERE name = 'Tomato Cherry';
UPDATE products SET retail_price = 699 WHERE name = 'Tomato Cherry Vine';
UPDATE products SET retail_price = 399 WHERE name = 'Tomato Plum';
UPDATE products SET retail_price = 400 WHERE name = 'Watermelon';
UPDATE products SET retail_price = 299 WHERE name = 'Parsnip';
