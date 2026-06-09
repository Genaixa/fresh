-- Function used by Data Golem to find regularly-bought products
-- whose last invoice appearance was more than stale_days ago.

CREATE OR REPLACE FUNCTION golem_stale_costs(
  supplier_filter text DEFAULT NULL,
  stale_days      int  DEFAULT 14,
  min_appearances int  DEFAULT 3
)
RETURNS TABLE (
  id               uuid,
  name             text,
  last_invoice_date date,
  days_since        int
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.name,
    MAX(pi.invoice_date)::date                                  AS last_invoice_date,
    (CURRENT_DATE - MAX(pi.invoice_date)::date)::int            AS days_since
  FROM products p
  JOIN purchase_invoice_items pii ON pii.product_id = p.id
  JOIN purchase_invoices pi       ON pi.id = pii.invoice_id
  WHERE p.is_active     = true
    AND p.purchase_cost > 0
    AND (supplier_filter IS NULL OR pi.supplier_name ILIKE '%' || supplier_filter || '%')
  GROUP BY p.id, p.name
  HAVING COUNT(pii.id) >= min_appearances
     AND (CURRENT_DATE - MAX(pi.invoice_date)::date) > stale_days
  ORDER BY days_since DESC;
$$;
