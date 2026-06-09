-- CHILEAN - SIZE 1 (JR Holland) = large Spanish onions, 20kg bag.
-- Cost per kg: £12 bag ÷ 20kg = 60p/kg. Retail £1.80/kg.
UPDATE products
SET purchase_cost = 60,
    case_size     = 20
WHERE name = 'Onion Spanish';

UPDATE supplier_product_mappings
SET units_per_case = 20
WHERE raw_description = 'CHILEAN - SIZE 1';
