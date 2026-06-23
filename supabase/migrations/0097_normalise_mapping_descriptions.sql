-- ═══════════════════════════════════════════════════════════════════════════════
-- 0097 — Normalise raw_description in supplier_product_mappings
-- ═══════════════════════════════════════════════════════════════════════════════
-- Punctuation/whitespace variants of the same supplier description
-- ("ONION . SPAIN 1 20KG ." vs "ONION. SPAIN 1 20KG.") bypassed the exact-match
-- key and spawned near-duplicate mapping rows + endless punctuation-only re-asks.
--
-- Fix: a normalised_description column (case/punctuation/whitespace-insensitive,
-- but decimal-safe so 2.27KG is preserved) becomes the matching key. The canonical
-- normaliser lives in app code — normaliseDescription() in src/lib/invoice-parser.ts —
-- and is applied on every write (saveMapping, mapping-golem). The SQL below mirrors it
-- for backfilling existing rows / fresh environments; the live prod backfill was done
-- with the JS function directly to guarantee an exact match.
--
-- Idempotent: safe to replay (column IF NOT EXISTS, backfill only fills NULLs,
-- dedup is a no-op once unique, index IF NOT EXISTS).

-- 1. Column
ALTER TABLE supplier_product_mappings
  ADD COLUMN IF NOT EXISTS normalised_description text;

-- 2. Backfill NULLs — decimal-safe: protect digit.digit, strip separator . and ,,
--    collapse whitespace, upper-case, trim.
UPDATE supplier_product_mappings
SET normalised_description = upper(btrim(regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(raw_description, '([0-9])[.,]([0-9])', '\1¤\2', 'g'),
          '[.,]', ' ', 'g'),
        '¤', '.', 'g'),
      '\s+', ' ', 'g')))
WHERE normalised_description IS NULL;

-- 3. Dedup: keep one row per (supplier_name, normalised_description).
--    Priority confirmed > pending > skipped, then most-used, then shortest spelling.
DELETE FROM supplier_product_mappings spm
USING (
  SELECT id, row_number() OVER (
    PARTITION BY supplier_name, normalised_description
    ORDER BY (CASE status WHEN 'confirmed' THEN 0 WHEN 'pending' THEN 1 WHEN 'skipped' THEN 2 ELSE 3 END),
             (appearances + match_count) DESC,
             length(raw_description) ASC
  ) AS rn
  FROM supplier_product_mappings
  WHERE normalised_description IS NOT NULL
) d
WHERE spm.id = d.id AND d.rn > 1;

-- 4. Unique key the matcher now upserts/looks up on.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_spm_supplier_normalised
  ON supplier_product_mappings (supplier_name, normalised_description);

-- 5. Ledger
INSERT INTO schema_migration_log (filename)
VALUES ('0097_normalise_mapping_descriptions.sql')
ON CONFLICT DO NOTHING;
