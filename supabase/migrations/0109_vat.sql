-- 0109_vat.sql
-- VAT mechanism for the till.
--
-- Retail prices are VAT-INCLUSIVE (UK retail). VAT per line is therefore the
-- inclusive portion:  vat = round(line_total * rate / (10000 + rate)).
-- Rate is stored in basis points (2000 = 20%, 500 = 5%, 0 = zero-rated).
--
-- Default 0 is deliberately safe and correct: fresh produce is zero-rated, so
-- nothing claims VAT until a rate is explicitly set per product (a call for
-- David / the accountant — standard-rated items are the exception, e.g. some
-- drinks/confectionery). The machinery below is inert at 0% and becomes correct
-- the moment real rates are entered.

ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate_bps integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN products.vat_rate_bps IS
  'VAT rate in basis points (2000 = 20%, 0 = zero-rated). Retail price is VAT-inclusive.';

ALTER TABLE till_z_reports ADD COLUMN IF NOT EXISTS vat_pence integer NOT NULL DEFAULT 0;

-- Recreate the close to also snapshot the period's VAT (computed from each sold
-- line's product rate). Signature unchanged from 0108.
CREATE OR REPLACE FUNCTION close_z_report(p_counted_cash integer DEFAULT NULL)
RETURNS till_z_reports AS $$
DECLARE
  v_prev_closed timestamptz;
  v_id uuid;
  v_report till_z_reports;
BEGIN
  SELECT closed_at INTO v_prev_closed FROM till_z_reports ORDER BY z_number DESC LIMIT 1;

  INSERT INTO till_z_reports (opened_at, created_by)
  VALUES (v_prev_closed, auth.uid())
  RETURNING id INTO v_id;

  UPDATE till_transactions   SET z_report_id = v_id WHERE z_report_id IS NULL;
  UPDATE till_cash_movements SET z_report_id = v_id WHERE z_report_id IS NULL;

  UPDATE till_z_reports z SET
    gross_pence         = COALESCE(s.gross, 0),
    cash_pence          = COALESCE(s.cash, 0),
    card_pence          = COALESCE(s.card, 0),
    txn_count           = COALESCE(s.txns, 0),
    void_count          = COALESCE(s.voids, 0),
    voided_pence        = COALESCE(s.voided, 0),
    vat_pence           = COALESCE(v.vat, 0),
    opening_float_pence = COALESCE(c.float_open, 0),
    cash_paid_in_pence  = COALESCE(c.pay_in, 0),
    cash_paid_out_pence = COALESCE(c.pay_out, 0),
    expected_cash_pence = COALESCE(c.float_open, 0) + COALESCE(s.cash, 0)
                          + COALESCE(c.pay_in, 0) - COALESCE(c.pay_out, 0),
    counted_cash_pence  = p_counted_cash,
    cash_variance_pence = CASE WHEN p_counted_cash IS NULL THEN NULL
                          ELSE p_counted_cash - (COALESCE(c.float_open, 0) + COALESCE(s.cash, 0)
                               + COALESCE(c.pay_in, 0) - COALESCE(c.pay_out, 0)) END
  FROM
    (SELECT
       sum(total_pence) FILTER (WHERE status='completed')                            AS gross,
       sum(total_pence) FILTER (WHERE status='completed' AND payment_method='cash')  AS cash,
       sum(total_pence) FILTER (WHERE status='completed' AND payment_method='card')  AS card,
       count(*)         FILTER (WHERE status='completed')                            AS txns,
       count(*)         FILTER (WHERE status='voided')                               AS voids,
       sum(total_pence) FILTER (WHERE status='voided')                               AS voided
     FROM till_transactions WHERE z_report_id = v_id) s,
    (SELECT
       sum(amount_pence) FILTER (WHERE kind='float_open') AS float_open,
       sum(amount_pence) FILTER (WHERE kind='pay_in')     AS pay_in,
       sum(amount_pence) FILTER (WHERE kind='pay_out')    AS pay_out
     FROM till_cash_movements WHERE z_report_id = v_id) c,
    (SELECT
       COALESCE(sum(round(i.line_total_pence::numeric * p.vat_rate_bps / (10000 + p.vat_rate_bps))), 0) AS vat
     FROM till_transaction_items i
     JOIN till_transactions t ON t.id = i.transaction_id
     JOIN products p ON p.id = i.product_id
     WHERE t.z_report_id = v_id AND t.status = 'completed' AND p.vat_rate_bps > 0) v
  WHERE z.id = v_id
  RETURNING z.* INTO v_report;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
