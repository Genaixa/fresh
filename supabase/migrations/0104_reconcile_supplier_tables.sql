-- 0104_reconcile_supplier_tables.sql
-- Reconcile the two supplier tables down to one.
--
-- Background: the app historically grew TWO supplier tables holding the SAME
-- suppliers:
--   * `suppliers`          (ids 11111111-…) — CANONICAL. Referenced by
--                          purchase_invoices, product_suppliers, market_session_items.
--                          Has contact columns (0101) and is_active.
--   * `purchase_suppliers` (ids aaaaaaaa-…) — legacy. Referenced ONLY by
--                          products.default_supplier_id.
-- The split silently breaks cost propagation for every new supplier (e.g. the
-- 24 Jun Milk fix had to hardcode an aaaaaaaa- id; see 0103). This migration
-- repoints products.default_supplier_id at `suppliers`, swaps the FK, and drops
-- `purchase_suppliers`.
--
-- The id pairs map 1:1 by their final UUID group:
--   aaaaaaaa-000N-0000-0000-00000000000N  <->  11111111-0000-0000-0000-00000000000N
--   N: 1=JR Holland  2=Total Produce  3=Thomas Baty  4=The Milk Company
--
-- Idempotent: once `purchase_suppliers` is gone the whole block is skipped.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.purchase_suppliers') IS NULL THEN
    RAISE NOTICE '0104: purchase_suppliers already gone — nothing to do';
    RETURN;
  END IF;

  -- Safety gate: every referenced legacy id must map to exactly one canonical
  -- supplier (match on the final UUID group). Abort rather than orphan a product.
  IF EXISTS (
    SELECT 1 FROM products p
    WHERE p.default_supplier_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM suppliers s
        WHERE right(s.id::text, 12) = right(p.default_supplier_id::text, 12)
      )
  ) THEN
    RAISE EXCEPTION '0104 abort: a products.default_supplier_id has no canonical suppliers match';
  END IF;

  -- 1. Drop the old FK first — it points at purchase_suppliers and would reject
  --    the repointed (11111111-…) ids mid-UPDATE.
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_default_supplier_id_fkey;

  -- 2. Repoint to canonical suppliers ids.
  UPDATE products p
  SET default_supplier_id = s.id
  FROM suppliers s
  WHERE p.default_supplier_id IS NOT NULL
    AND right(s.id::text, 12) = right(p.default_supplier_id::text, 12)
    AND p.default_supplier_id <> s.id;

  -- 3. Add the new FK targeting suppliers.
  ALTER TABLE products
    ADD CONSTRAINT products_default_supplier_id_fkey
    FOREIGN KEY (default_supplier_id) REFERENCES suppliers(id);

  -- 4. Drop the legacy table (nothing else references it).
  DROP TABLE purchase_suppliers;
END $$;

-- Post-condition assertions (fail the migration if anything is off).
DO $$
DECLARE
  unmapped int;
BEGIN
  SELECT count(*) INTO unmapped
  FROM products p
  WHERE p.default_supplier_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.id = p.default_supplier_id);
  IF unmapped > 0 THEN
    RAISE EXCEPTION '0104 post-check failed: % products.default_supplier_id not in suppliers', unmapped;
  END IF;
END $$;

COMMIT;
