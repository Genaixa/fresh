-- Returns 90-day average per-retail-unit cost for a list of products,
-- excluding a specified invoice (used for anomaly detection on the review page).
CREATE OR REPLACE FUNCTION product_cost_benchmarks(
  p_product_ids       uuid[],
  p_exclude_invoice_id uuid
)
RETURNS TABLE (
  product_id      uuid,
  avg_cost_pence  integer,
  invoice_count   bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    pii.product_id,
    ROUND(
      SUM(pii.quantity * pii.unit_cost) /
      NULLIF(SUM(pii.quantity * CASE
        WHEN pii.unit_type = 'weight' AND pii.box_weight_kg IS NOT NULL THEN pii.box_weight_kg
        ELSE COALESCE(pii.units_per_case, 1)::numeric
      END), 0)
    )::integer AS avg_cost_pence,
    COUNT(DISTINCT pi.id) AS invoice_count
  FROM purchase_invoice_items pii
  JOIN purchase_invoices pi ON pi.id = pii.invoice_id
  WHERE pii.product_id = ANY(p_product_ids)
    AND pii.is_matched = true
    AND pi.id != p_exclude_invoice_id
    AND pi.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY pii.product_id
  HAVING COUNT(DISTINCT pi.id) >= 2
$$;
