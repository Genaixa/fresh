-- ============================================================
-- Market screen tables.
-- Tracks David's daily market buying sessions, what he
-- bought from whom at what price, and seasonal price
-- baselines for deal-quality scoring.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- market_sessions — one row per day David goes to market
-- ────────────────────────────────────────────────────────────
CREATE TABLE market_sessions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  UNIQUE (session_date)
);

CREATE INDEX idx_market_sessions_date ON market_sessions (session_date DESC);

-- ────────────────────────────────────────────────────────────
-- market_session_items — one row per product per session
-- ────────────────────────────────────────────────────────────
CREATE TABLE market_session_items (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id             uuid NOT NULL REFERENCES market_sessions (id) ON DELETE CASCADE,
  product_id             uuid NOT NULL REFERENCES products (id),
  supplier_id            uuid REFERENCES suppliers (id),
  qty_boxes              numeric(8,2) NOT NULL DEFAULT 0,
  price_pence            integer,           -- what David typed at the stall
  verified_price_pence   integer,           -- from delivery note after parsing
  price_disputed         boolean NOT NULL DEFAULT false,
  qty_breakdown          jsonb,             -- e.g. {"shop": 8, "Old Sem": 5}
  deal_status            text CHECK (deal_status IN ('green', 'amber', 'red')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, product_id)
);

CREATE INDEX idx_msi_session ON market_session_items (session_id);
CREATE INDEX idx_msi_product ON market_session_items (product_id);

CREATE TRIGGER set_market_session_items_updated_at
  BEFORE UPDATE ON market_session_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- product_seasonal_averages — historical price baselines
-- Populated by the seasonal calculator script, not user input.
-- ────────────────────────────────────────────────────────────
CREATE TABLE product_seasonal_averages (
  product_id      uuid NOT NULL REFERENCES products (id),
  month_number    integer NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  avg_price_pence integer NOT NULL,   -- average box price in pence for this month
  sample_count    integer NOT NULL DEFAULT 0,
  min_year        integer,
  max_year        integer,
  last_computed   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, month_number)
);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE market_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_session_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_seasonal_averages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages market sessions"
  ON market_sessions FOR ALL
  USING (current_user_role() = 'owner');

CREATE POLICY "owner manages market session items"
  ON market_session_items FOR ALL
  USING (current_user_role() = 'owner');

CREATE POLICY "owner and cashier reads seasonal averages"
  ON product_seasonal_averages FOR SELECT
  USING (current_user_role() IN ('owner', 'cashier'));

CREATE POLICY "owner manages seasonal averages"
  ON product_seasonal_averages FOR ALL
  USING (current_user_role() = 'owner');
