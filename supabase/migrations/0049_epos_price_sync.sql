-- Prices from Epos Now export (Jun 2026)

UPDATE products SET retail_price = 450  WHERE name = 'Potato Bag';          -- 7.5 KG Potato £4.50
UPDATE products SET retail_price = 48   WHERE name = 'Lemon';               -- Lemons £0.48 (fixes below-floor margin)
UPDATE products SET retail_price = 100  WHERE name = 'Plums Punnet';        -- Punnet Plum £1.00
UPDATE products SET retail_price = 125  WHERE name = 'Mushroom Punnet';     -- Mushroom Punnet £1.25
UPDATE products SET retail_price = 280  WHERE name = 'Pear Conference (Punnet)'; -- Pear Conference Punnet £2.80
