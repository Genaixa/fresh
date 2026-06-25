-- 0107_till_z_reports.sql
-- X/Z end-of-day reports for the till.
--
--   X-read = a running snapshot of the open trading period. Read-only, take it
--            as many times as you like; it changes nothing. (Computed live in
--            the page from transactions WHERE z_report_id IS NULL.)
--   Z-read = the end-of-day close. Seals every transaction in the open period
--            under a new, sequentially-numbered Z report and snapshots its
--            totals, then the next period starts empty.
--
-- Sealing is explicit (each sale is stamped with the Z that closed it) rather
-- than by timestamp range, so a sale that was rung offline and syncs late just
-- joins whatever period is open when it lands — it can never slip through a
-- close boundary or be counted twice.

CREATE TABLE IF NOT EXISTS till_z_reports (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  z_number      serial UNIQUE,                       -- sequential close number
  opened_at     timestamptz,                         -- = previous Z's closed_at (NULL for the first close)
  closed_at     timestamptz NOT NULL DEFAULT now(),
  gross_pence   integer NOT NULL DEFAULT 0,          -- completed sales only
  cash_pence    integer NOT NULL DEFAULT 0,
  card_pence    integer NOT NULL DEFAULT 0,
  txn_count     integer NOT NULL DEFAULT 0,          -- completed transactions
  void_count    integer NOT NULL DEFAULT 0,
  voided_pence  integer NOT NULL DEFAULT 0,
  created_by    uuid
);

ALTER TABLE till_z_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS till_z_auth ON till_z_reports;
CREATE POLICY till_z_auth ON till_z_reports TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE till_transactions
  ADD COLUMN IF NOT EXISTS z_report_id uuid REFERENCES till_z_reports(id);

-- Fast "open period" lookups (the unsealed set).
CREATE INDEX IF NOT EXISTS idx_till_tx_open_period
  ON till_transactions (z_report_id) WHERE z_report_id IS NULL;

-- Close the open period atomically and return the new Z report.
-- Order matters: create the report, STAMP the open set, THEN aggregate exactly
-- the stamped rows — so the money totalled is precisely the money sealed, with
-- no race against a sale landing mid-close.
CREATE OR REPLACE FUNCTION close_z_report() RETURNS till_z_reports AS $$
DECLARE
  v_prev_closed timestamptz;
  v_id uuid;
  v_report till_z_reports;
BEGIN
  SELECT closed_at INTO v_prev_closed FROM till_z_reports ORDER BY z_number DESC LIMIT 1;

  INSERT INTO till_z_reports (opened_at, created_by)
  VALUES (v_prev_closed, auth.uid())
  RETURNING id INTO v_id;

  UPDATE till_transactions SET z_report_id = v_id WHERE z_report_id IS NULL;

  UPDATE till_z_reports z SET
    gross_pence  = COALESCE(s.gross, 0),
    cash_pence   = COALESCE(s.cash, 0),
    card_pence   = COALESCE(s.card, 0),
    txn_count    = COALESCE(s.txns, 0),
    void_count   = COALESCE(s.voids, 0),
    voided_pence = COALESCE(s.voided, 0)
  FROM (
    SELECT
      sum(total_pence) FILTER (WHERE status = 'completed')                            AS gross,
      sum(total_pence) FILTER (WHERE status = 'completed' AND payment_method = 'cash') AS cash,
      sum(total_pence) FILTER (WHERE status = 'completed' AND payment_method = 'card') AS card,
      count(*)         FILTER (WHERE status = 'completed')                            AS txns,
      count(*)         FILTER (WHERE status = 'voided')                               AS voids,
      sum(total_pence) FILTER (WHERE status = 'voided')                               AS voided
    FROM till_transactions WHERE z_report_id = v_id
  ) s
  WHERE z.id = v_id
  RETURNING z.* INTO v_report;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
