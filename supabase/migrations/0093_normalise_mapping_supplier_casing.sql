-- ═══════════════════════════════════════════════════════════════════════════════
-- 0093 — Normalise supplier_name casing in supplier_product_mappings
-- ═══════════════════════════════════════════════════════════════════════════════
-- Legacy rows stored as 'Total Produce' / 'JR Holland' (capitalised) bypass the
-- (supplier_name, raw_description) unique key and are UNREACHABLE by the matcher,
-- which always looks up normaliseSupplierName() = lower-cased. They create the
-- duplicate-key / mixed-basis confusion seen on satsuma.
--
-- Current insert paths (saveMapping, mapping-golem) already normalise, so this is a
-- one-off cleanup, not a recurring fix.

-- 1. Conflicts — a lower-cased twin already exists → drop the dead capitalised dup.
--    (The lower-cased row is the one the matcher actually uses; e.g. satsuma's
--     correct weight/10 twin wins over the stray capitalised count row.)
DELETE FROM supplier_product_mappings bad
USING supplier_product_mappings good
WHERE bad.supplier_name <> lower(bad.supplier_name)
  AND good.supplier_name = lower(bad.supplier_name)
  AND good.raw_description = bad.raw_description;

-- 2. The remaining capitalised rows have no twin → just lower-case them.
UPDATE supplier_product_mappings
SET supplier_name = lower(supplier_name), updated_at = now()
WHERE supplier_name <> lower(supplier_name);
