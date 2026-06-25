-- 0110_backfill_propagated_costs.sql
-- Fix a cost-propagation gap: 15 active products had purchase_cost = 0 despite
-- product_last_invoice (the source-of-truth cost view) holding a box price AND a
-- pack spec for them — i.e. the per-unit cost was computable all along, it just
-- never reached products.purchase_cost.
--
-- This backfills purchase_cost = box_price ÷ pack spec straight from the view, but
-- ONLY where the result is plausible (a real, non-negative margin). Five products
-- are deliberately left at 0 because their computed cost exposes a DIFFERENT bug,
-- not a cost gap — they need a human:
--   • Chestnuts   — retail is £0.10 (a price typo; cost would be £5.00/kg)
--   • Fig         — pack spec wrong (implies £1.83/fig vs 69p retail)
--   • Garlic Loose— pack spec wrong (implies a loss)
--   • Horseradish — no pack spec on the invoice line at all
--   • Tamarind    — fed by "TAMARILLO" invoice lines (likely a mis-mapping, not tamarind)
--
-- Idempotent: only touches rows still at 0.

UPDATE products p
SET purchase_cost = c.computed
FROM (
  SELECT li.product_id,
         CASE
           WHEN li.unit_type='weight' AND li.box_weight_kg  > 0 THEN round(li.box_price_pence / li.box_weight_kg)
           WHEN li.unit_type='count'  AND li.units_per_case > 0 THEN round(li.box_price_pence::numeric / li.units_per_case)
         END AS computed
  FROM product_last_invoice li
) c
WHERE p.id = c.product_id
  AND p.is_active
  AND p.purchase_cost = 0
  AND c.computed IS NOT NULL
  AND p.retail_price > 0
  AND c.computed <= p.retail_price          -- plausibility: no negative margin
  AND p.name <> 'Tamarind';                 -- mapping looks wrong; leave for review
