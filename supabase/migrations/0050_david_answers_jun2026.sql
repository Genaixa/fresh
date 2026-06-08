-- David's price answers (8 Jun 2026)

-- Cherry: sold per kg at £13.00
UPDATE products SET unit = 'kg', retail_price = 1300 WHERE name = 'Cherry';

-- Potato Mids: JR Holland box £25, 9 bags of 2.5kg = £2.78/bag cost, £4.99 retail
UPDATE products SET unit = 'each', retail_price = 499, purchase_cost = 278 WHERE name = 'Potato Mids';

-- Potato Washed: £1.20/kg (mostly wholesale)
UPDATE products SET retail_price = 120 WHERE name = 'Potato Washed';

-- Potato Bag: cost corrected from 32p/kg to 240p/bag (32p × 7.5kg)
UPDATE products SET purchase_cost = 240 WHERE name = 'Potato Bag';
