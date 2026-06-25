-- 0108_till_cash_management.sql
-- Cash drawer: opening float, in/out movements, and a counted cash-up at Z.
--
-- Expected drawer cash at close =
--     opening float + cash sales + pay-ins − pay-outs
-- Cash-up variance = counted − expected (over/short). The count + variance are
-- snapshotted onto the Z report, and cash movements are sealed under the Z just
-- like transactions, so each belongs to exactly one trading period.

CREATE TABLE IF NOT EXISTS till_cash_movements (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  kind         text NOT NULL CHECK (kind IN ('float_open','pay_in','pay_out')),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),  -- always positive; kind gives the sign
  note         text,
  z_report_id  uuid REFERENCES till_z_reports(id),
  created_by   uuid
);

ALTER TABLE till_cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS till_cash_auth ON till_cash_movements;
CREATE POLICY till_cash_auth ON till_cash_movements TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_till_cash_open
  ON till_cash_movements (z_report_id) WHERE z_report_id IS NULL;

ALTER TABLE till_z_reports
  ADD COLUMN IF NOT EXISTS opening_float_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_paid_in_pence  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_paid_out_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_cash_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counted_cash_pence  integer,            -- entered at close (nullable)
  ADD COLUMN IF NOT EXISTS cash_variance_pence integer;            -- counted − expected

-- Recreate the close with cash-up. Seals transactions AND cash movements under
-- the new Z, then snapshots sales + cash totals. counted may be NULL (no count).
DROP FUNCTION IF EXISTS close_z_report();           -- old zero-arg version (0107)
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

  UPDATE till_transactions  SET z_report_id = v_id WHERE z_report_id IS NULL;
  UPDATE till_cash_movements SET z_report_id = v_id WHERE z_report_id IS NULL;

  UPDATE till_z_reports z SET
    gross_pence         = COALESCE(s.gross, 0),
    cash_pence          = COALESCE(s.cash, 0),
    card_pence          = COALESCE(s.card, 0),
    txn_count           = COALESCE(s.txns, 0),
    void_count          = COALESCE(s.voids, 0),
    voided_pence        = COALESCE(s.voided, 0),
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
     FROM till_cash_movements WHERE z_report_id = v_id) c
  WHERE z.id = v_id
  RETURNING z.* INTO v_report;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
