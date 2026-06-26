-- 0120_supplier_last_unit_price.sql
-- Live, box-size-CORRECT per-unit price per (product, supplier), straight from the
-- latest matched invoice line — using THAT line's own pack spec, not a config guess.
-- This is what the market-run deal engine should compare against, instead of a frozen
-- seasonal average × an assumed box count (which false-flagged a 12kg apple box against
-- a 4kg-box budget all session). Pairs with product_weighted_costs (live 4-wk per-unit
-- average) as the benchmark.
CREATE OR REPLACE VIEW product_supplier_last_unit_price AS
SELECT DISTINCT ON (pii.product_id, pi.supplier_name)
  pii.product_id,
  pi.supplier_name,
  pi.invoice_date            AS last_date,
  pii.unit_cost              AS box_price_p,
  CASE
    WHEN pii.unit_type = 'weight' AND COALESCE(pii.box_weight_kg, 0)  > 0
      THEN ROUND(pii.unit_cost / pii.box_weight_kg)
    WHEN pii.unit_type = 'count'  AND COALESCE(pii.units_per_case, 0) > 0
      THEN ROUND(pii.unit_cost::numeric / pii.units_per_case)
    ELSE pii.unit_cost
  END                        AS unit_price_p
FROM purchase_invoice_items pii
JOIN purchase_invoices pi ON pi.id = pii.invoice_id
WHERE pii.is_matched AND pii.product_id IS NOT NULL
ORDER BY pii.product_id, pi.supplier_name, pi.invoice_date DESC, pii.created_at DESC;
