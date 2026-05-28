-- ============================================================
-- Box spec columns for purchase invoice items and mappings.
-- Switches pricing engine from count-only to weight OR count.
-- ============================================================

-- purchase_invoice_items: add unit_type, box_weight_kg, brand_raw
ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS unit_type      text CHECK (unit_type IN ('count', 'weight')),
  ADD COLUMN IF NOT EXISTS box_weight_kg  numeric(8,2),
  ADD COLUMN IF NOT EXISTS brand_raw      text;

-- supplier_product_mappings: make product_id nullable (pending state),
-- add box spec columns and review workflow columns
ALTER TABLE supplier_product_mappings
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS unit_type       text CHECK (unit_type IN ('count', 'weight')),
  ADD COLUMN IF NOT EXISTS units_per_case  integer,
  ADD COLUMN IF NOT EXISTS box_weight_kg   numeric(8,2),
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'confirmed'
                                           CHECK (status IN ('pending', 'confirmed', 'skipped')),
  ADD COLUMN IF NOT EXISTS last_price_p    integer,
  ADD COLUMN IF NOT EXISTS appearances     integer NOT NULL DEFAULT 1;

-- Mark all existing auto-matched mappings as confirmed (they had product_id set)
UPDATE supplier_product_mappings SET status = 'confirmed' WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spm_status ON supplier_product_mappings(status);
CREATE INDEX IF NOT EXISTS idx_spm_pending ON supplier_product_mappings(status, appearances DESC)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- Updated weighted average cost view.
-- Handles both weight-based (divide by kg) and count-based
-- (divide by units_per_case) items correctly.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW product_weighted_costs AS
SELECT
  pii.product_id,
  ROUND(
    SUM(pii.quantity * pii.unit_cost)
    / NULLIF(
        SUM(pii.quantity * CASE
          WHEN pii.unit_type = 'weight' AND pii.box_weight_kg IS NOT NULL
            THEN pii.box_weight_kg
          ELSE COALESCE(pii.units_per_case, 1)::numeric
        END),
        0
      )
  )::integer AS weighted_unit_cost_pence,
  SUM(pii.quantity)             AS total_boxes,
  MAX(pi.invoice_date)          AS last_purchase_date
FROM purchase_invoice_items pii
JOIN purchase_invoices pi ON pi.id = pii.invoice_id
WHERE pii.is_matched = TRUE
  AND pii.product_id IS NOT NULL
  AND pi.invoice_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY pii.product_id;
