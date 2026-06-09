-- Potato (Bag 2kg) was in the products table but marked inactive.
-- David confirmed 9 Jun 2026: retail £1.40 (already correct), add to catalogue.
-- Epos ID 4590146 confirmed from TSV exports.
-- weekly_units from 6-year Epos average (2020–2025 full year + 2026 YTD, 282.71 weeks):
--   total units: ~44,366 across 282.71 weeks = ~157/wk.
-- purchase_cost 65p already set (source unknown — review against next invoice).

UPDATE products
SET is_active    = true,
    weekly_units = 157
WHERE name = 'Potato (Bag 2kg)';
