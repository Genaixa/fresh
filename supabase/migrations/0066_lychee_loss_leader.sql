-- Lychee: 2kg bag ~90 fruits (85-95), £16/bag = 18p each.
-- Selling at 5 for £1 (20p each) = 10% margin, below 20% floor.
-- Too small to charge more — treating as loss leader alongside passion fruit.
-- margin_floor=-1.0 suppresses health alerts.
UPDATE products
SET purchase_cost = 18,
    retail_price  = 20,
    case_size     = 90,
    margin_floor  = -1.0
WHERE name = 'Lychee';
