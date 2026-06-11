-- Loss-leader flag: products deliberately sold at/below cost.
-- Excluded from margin/price-fix alerts and the CFO "losing money" briefing,
-- so we don't tell David to raise a price he's intentionally keeping low.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_loss_leader boolean NOT NULL DEFAULT false;

-- Passion Fruit is David's loss-leader (3 for £1 ≈ 33p, costs ~39p).
UPDATE products SET is_loss_leader = true WHERE name = 'Passion Fruit';

-- Fix Lychee cost: £8.00 was the BOX price (case of 90) wrongly entered into the
-- per-unit purchase_cost field, while retail_price (20p) is per single lychee.
-- Per-lychee cost = 800/90 ≈ 9p → ~55% margin. Removes the bogus -3900% alert.
UPDATE products SET purchase_cost = 9 WHERE name = 'Lychee' AND purchase_cost = 800;
