-- ── Allow intentional loss leaders through the cost safety guard ─────────────
-- Products with margin_floor < 0 are deliberately priced below cost.
-- The trigger should not block them.
CREATE OR REPLACE FUNCTION fn_block_dangerous_cost_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Skip guard for intentional loss leaders (margin_floor set negative by hand)
  IF NEW.margin_floor < 0 THEN
    RETURN NEW;
  END IF;

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
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Passion Fruit: 30-40 fruits per 1.5kg box (use midpoint 35) ──────────────
-- Latest box Jun 3: £13.50 / 35 = 39p per fruit.
-- Selling at 33p (3 for £1) is a deliberate loss leader — draws customers
-- who typically buy other items. Loss ~6p/fruit, ~£2/box.
UPDATE products
SET purchase_cost = 39,
    case_size     = 35
WHERE name = 'Passion Fruit';
