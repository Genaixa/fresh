-- ═══════════════════════════════════════════════════════════════════════════════
-- Price Plausibility Filter — stops bogus retail prices reaching David or the till.
--
-- The cost guards (0061) protect the *stored cost*. But a price *suggestion* is
-- computed from the weighted cost independently of whether the cost write was
-- blocked — so a case-as-unit parse (e.g. a £14.50 avocado box read as per-unit)
-- still produces a £29 suggestion that lands in the pending list and can be
-- "Approve All"-ed straight to the shelf. Nothing guarded the retail write.
--
-- Two layers added here:
--   1. New 'withheld' suggestion status + reason/ceiling columns. The suggestion
--      generators (confirm-invoice.ts, pricing/actions.ts) divert implausible
--      suggestions to 'withheld' so they never enter the pending / Approve-All /
--      Telegram path. They stay visible in a /pricing review queue.
--   2. trg_retail_plausibility_guard — BEFORE UPDATE OF retail_price. Last-resort
--      backstop: blocks any write (automated OR manual) that pushes retail wildly
--      outside the plausible band, unless app.bypass_price_guard is set.
--
-- Plausible ceiling (mirrors checkPlausibility() in pricing-engine.ts — keep in sync):
--   max( current_retail × 3,  hist_retail_max × 3,  category_median × 4 )
-- Only the HIGH side is guarded — loss leaders (passion fruit, lychee) sell below
-- cost intentionally, so the low side is deliberately left alone.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Withheld status + diagnostic columns ───────────────────────────────────

ALTER TYPE suggestion_status ADD VALUE IF NOT EXISTS 'withheld';

ALTER TABLE price_suggestions ADD COLUMN IF NOT EXISTS block_reason         text;
ALTER TABLE price_suggestions ADD COLUMN IF NOT EXISTS plausibility_ceiling integer;  -- pence


-- ── 2. Retail-write plausibility guard ────────────────────────────────────────
-- Reuses cost_change_audit (0061) as the shared price-safety log; source tags the
-- retail events. proposed_cost = the blocked retail price, retail_price = ceiling.

CREATE OR REPLACE FUNCTION fn_block_implausible_retail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cat_median  integer;
  v_hist_max    integer;
  v_ceiling     integer;
  v_anchors     integer[] := '{}';
BEGIN
  -- Explicit override (set by apply_retail_override / admin migrations)
  IF current_setting('app.bypass_price_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Category median across active, priced products
  SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY retail_price))::integer
    INTO v_cat_median
    FROM products
   WHERE category = NEW.category AND is_active AND retail_price > 0;

  -- Best-ever retail for this product
  SELECT max(new_price) INTO v_hist_max
    FROM price_history
   WHERE product_id = NEW.id AND price_type = 'retail';

  -- Build anchors (mirror of pricing-engine.ts constants)
  IF OLD.retail_price >= 20 THEN v_anchors := v_anchors || (OLD.retail_price * 3); END IF;
  IF v_hist_max     >= 20 THEN v_anchors := v_anchors || (v_hist_max * 3);     END IF;
  IF v_cat_median IS NOT NULL AND v_cat_median > 0 THEN v_anchors := v_anchors || (v_cat_median * 4); END IF;

  -- No anchor at all → can't judge, allow.
  IF array_length(v_anchors, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max(a) INTO v_ceiling FROM unnest(v_anchors) AS a;

  IF NEW.retail_price > v_ceiling THEN
    INSERT INTO cost_change_audit
      (product_id, product_name, old_cost, proposed_cost, retail_price, reason, blocked, source)
    VALUES
      (NEW.id, NEW.name, OLD.retail_price, NEW.retail_price, v_ceiling,
       'Blocked retail £' || to_char(NEW.retail_price / 100.0, 'FM999990.00')
         || ' — exceeds plausible max £' || to_char(v_ceiling / 100.0, 'FM999990.00')
         || ' (was £' || to_char(OLD.retail_price / 100.0, 'FM999990.00')
         || '). Looks like a bad cost or multiplier. Use "Apply anyway" on /pricing to override.',
       true, 'retail_guard');

    -- Cancel the update; the audit row above persists.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_retail_plausibility_guard
  BEFORE UPDATE OF retail_price ON products
  FOR EACH ROW
  WHEN (NEW.retail_price IS DISTINCT FROM OLD.retail_price AND NEW.retail_price > 0)
  EXECUTE FUNCTION fn_block_implausible_retail();


-- ── 3. Explicit override path ─────────────────────────────────────────────────
-- Used by the "Apply anyway" action on a withheld suggestion. Sets the bypass
-- GUC for the duration of this function's transaction only.

CREATE OR REPLACE FUNCTION apply_retail_override(p_id uuid, p_price integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'apply_retail_override: price must be positive (got %)', p_price;
  END IF;
  PERFORM set_config('app.bypass_price_guard', 'on', true);  -- local: this txn only
  UPDATE products SET retail_price = p_price WHERE id = p_id;
END;
$$;
