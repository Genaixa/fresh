-- 0115_retire_garlic_peeled_dup.sql
-- Q16: the live peeled-garlic till button is "Peeled garlic 1kg pack" — David confirms
-- that's "Garlic Peeled Pack". Retire the duplicate "Garlic Peeled" (bag, 0 sales).
-- "Garlic Prepack" (unpeeled prepack, active) and "Garlic Loose" are unrelated — left as-is.
UPDATE products SET is_active = false
  WHERE name = 'Garlic Peeled' AND is_active;
