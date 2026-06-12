-- Flag products whose cost/unit is unconfirmed (awaiting David), so the
-- buying-guide quarantines them by CAUSE (known-unconfirmed) not just by
-- SYMPTOM (margin >75%). A wrong cost doesn't always look impossible —
-- e.g. Red Cabbage's guessed 50p lands at a believable 74%.
ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

UPDATE products SET needs_review = true WHERE name IN (
  'Ginger', 'Leek', 'Kohlrabi', 'Tomato', 'Red Cabbage', 'Nectarine Punnet',
  'Garlic Loose', 'Chilli (Red)'
);
