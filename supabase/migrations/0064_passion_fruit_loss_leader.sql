-- Passion Fruit: intentional loss leader at 3 for £1 (33p each).
-- David keeps it as a shop attraction — customers treat themselves but buy
-- other things too. margin_floor=-1.0 suppresses health alerts for this product.
UPDATE products
SET retail_price = 33,
    margin_floor = -1.0
WHERE name = 'Passion Fruit';
