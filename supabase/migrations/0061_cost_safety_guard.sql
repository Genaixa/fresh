-- ═══════════════════════════════════════════════════════════════════════════════
-- Cost Safety Guard — prevents invoice pipeline from overwriting good per-unit
-- costs with raw per-case prices.
--
-- Three independent protections:
--   1. product_weighted_costs view fixed — uses product.case_size as fallback
--      when units_per_case is not stored on the invoice item
--   2. DB trigger — BEFORE UPDATE on purchase_cost; blocks cost > retail_price
--   3. Audit table — every blocked/suspicious cost change is logged here;
--      the dashboard surfaces a badge when there are recent blocked attempts
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Audit table ────────────────────────────────────────────────────────────

CREATE TABLE cost_change_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id) ON DELETE CASCADE,
  product_name  text NOT NULL,
  old_cost      integer,
  proposed_cost integer NOT NULL,
  retail_price  integer,
  reason        text NOT NULL,
  blocked       boolean NOT NULL DEFAULT true,
  source        text,           -- 'trigger' | 'pipeline' | 'manual'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Dashboard only needs recent rows; keep 90 days
CREATE INDEX idx_cost_audit_created ON cost_change_audit (created_at DESC);
CREATE INDEX idx_cost_audit_product  ON cost_change_audit (product_id);


-- ── 2. DB trigger: block cost > retail_price ──────────────────────────────────
-- This is the nuclear option: no legitimate scenario exists where purchase_cost
-- should exceed retail_price for an active product with a known retail price.
-- If this fires, something has gone badly wrong upstream.

CREATE OR REPLACE FUNCTION fn_block_dangerous_cost_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce when retail price is known (>0)
  IF NEW.retail_price > 0 AND NEW.purchase_cost > NEW.retail_price THEN

    INSERT INTO cost_change_audit
      (product_id, product_name, old_cost, proposed_cost, retail_price, reason, blocked, source)
    VALUES
      (NEW.id, NEW.name, OLD.purchase_cost, NEW.purchase_cost, NEW.retail_price,
       'cost ' || NEW.purchase_cost || 'p > retail ' || NEW.retail_price
         || 'p (ratio ' || ROUND(NEW.purchase_cost::numeric / NULLIF(NEW.retail_price,0), 1)
         || 'x) — likely per-case price stored as per-unit. '
         || 'Check units_per_case in purchase_invoice_items and case_size on the product.',
       true, 'trigger');

    -- RETURN NULL silently cancels the row update; the audit INSERT above persists.
    -- The application-layer guard in confirm-invoice.ts also blocks this before it
    -- reaches the DB — the trigger is the last-resort backstop.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cost_safety_guard
  BEFORE UPDATE OF purchase_cost ON products
  FOR EACH ROW
  WHEN (NEW.purchase_cost IS DISTINCT FROM OLD.purchase_cost AND NEW.purchase_cost IS NOT NULL)
  EXECUTE FUNCTION fn_block_dangerous_cost_update();


-- ── 3. Fix product_weighted_costs view ────────────────────────────────────────
-- Previous: COALESCE(units_per_case, 1)  ← defaults to 1 when case info missing
-- Fixed:    COALESCE(units_per_case, p.case_size, 1)
--           ↑ uses the product's known case_size before falling back to 1
-- This means even if an invoice item is imported without units_per_case set,
-- the cost calculation will still divide by the correct number of units.

CREATE OR REPLACE VIEW product_weighted_costs AS
SELECT
  pii.product_id,
  round(
    sum(pii.quantity * pii.unit_cost::numeric)
    / NULLIF(
        sum(pii.quantity *
          CASE
            WHEN pii.unit_type = 'weight' AND pii.box_weight_kg IS NOT NULL
              THEN pii.box_weight_kg
            ELSE COALESCE(pii.units_per_case, p.case_size, 1)::numeric
          END
        ),
        0::numeric
      )
  )::integer AS weighted_unit_cost_pence,
  sum(pii.quantity)    AS total_boxes,
  max(pi.invoice_date) AS last_purchase_date
FROM purchase_invoice_items pii
JOIN purchase_invoices  pi ON pi.id  = pii.invoice_id
JOIN products           p  ON p.id   = pii.product_id
WHERE pii.is_matched = true
  AND pii.product_id IS NOT NULL
  AND pi.invoice_date >= (CURRENT_DATE - '7 days'::interval)
GROUP BY pii.product_id;
