-- 0113_david_email_answers_25jun.sql
-- Apply the clear, low-risk answers from David's 25-Jun email. The deliberately
-- DEFERRED items (potato consolidation, Baby-Roast & Date-Box costs, garlic dedup,
-- strawberry, Red-Delicious pricing) are NOT touched here — they need either a box
-- price we don't have, an EPOS-button merge decision, or a follow-up answer. See the
-- session checkpoint for the full audit.
--
-- Idempotent: each statement is a targeted UPDATE keyed by product name / mapping.

-- ── Q18: costs for items that appear on no invoice (David gave them by hand) ──────
-- Eggs: £75 for 12 trays → 625p/tray.
UPDATE products SET purchase_cost = 625
  WHERE name = 'Eggs Tray Large' AND purchase_cost = 0;
-- Roasted Almonds / Pistachios: ~£1.10 per pack after VAT.
UPDATE products SET purchase_cost = 110
  WHERE name IN ('Roasted Almonds','Roasted Pistachios') AND purchase_cost = 0;

-- ── Q5/Q6/Q7: prepack punnets = 1kg each (10 punnets per box). Cost a 1kg punnet
-- at the per-kg cost of its loose/kg sibling. These products carry no invoice line,
-- so the cost is set by hand (manual, derived from David's pack info).
UPDATE products SET purchase_cost = 158   -- Pear Conference is 158p/kg
  WHERE name = 'Pear Conference (Punnet)' AND purchase_cost = 0;
UPDATE products SET purchase_cost = 186   -- Tangerine is 186p/kg (David copy-pasted the pear line; confirm)
  WHERE name = 'Tangerine (Punnet)' AND purchase_cost = 0;
UPDATE products SET purchase_cost = 225   -- Sharon ~225p/kg (Total Produce 2kg@£4.50 & 4kg@£9.00)
  WHERE name = 'Sharon Fruit Punnet' AND purchase_cost = 0;

-- ── Q1: Sweet potato box = 6kg. One JR Holland mapping (ZANOBEET) had no weight;
-- the rest already say 6kg. Backfill so its per-kg cost computes.
UPDATE supplier_product_mappings
  SET box_weight_kg = 6.00, unit_type = COALESCE(NULLIF(unit_type,''), 'weight')
  WHERE supplier_name = 'jr holland'
    AND normalised_description = 'SWEET POTATOES - XL "ZANOBEET"'
    AND box_weight_kg IS NULL;

-- ── Q12: Gooseberry breakeven (cost £2.50 / sell £2.49) is INTENDED. Mark it an
-- intentional loss-leader (margin_floor < 0) so it stops surfacing under ⚠ Issues
-- and the cost-guard trigger leaves it alone.
UPDATE products SET margin_floor = -0.01
  WHERE name = 'Gooseberry' AND margin_floor >= 0;

-- ── Q17: Apple Cripps Pink was a one-off, no longer sold. Retire it.
UPDATE products SET is_active = false
  WHERE name = 'Apple Cripps Pink' AND is_active;
