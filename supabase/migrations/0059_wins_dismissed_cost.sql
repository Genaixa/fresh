-- Stores the purchase_cost at which David dismissed a Wins tab suggestion.
-- Card re-appears when ABS(purchase_cost - wins_dismissed_cost) >= 10 (10p threshold).
ALTER TABLE products ADD COLUMN wins_dismissed_cost integer;
