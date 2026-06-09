-- Data Golem alert store
-- Findings from the post-invoice and daily sweep agent

CREATE TABLE golem_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   text        NOT NULL,  -- 'unmatched_item' | 'stale_cost' | 'cost_drift' | 'margin_erosion' | 'holiday_prep' | 'delivery_gap' | 'arbitrage' | 'expired_suggestions'
  severity     text        NOT NULL DEFAULT 'warning',  -- 'critical' | 'warning' | 'info'
  product_id   uuid        REFERENCES products(id),
  product_name text,
  message      text        NOT NULL,
  action       text,
  resolved     boolean     NOT NULL DEFAULT false,
  source       text        NOT NULL DEFAULT 'data_golem',  -- 'data_golem' | 'daily_sweep'
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX golem_alerts_resolved_idx ON golem_alerts (resolved, created_at DESC);
CREATE INDEX golem_alerts_type_idx     ON golem_alerts (alert_type, created_at DESC);

-- Daily LLM briefings
CREATE TABLE golem_briefings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date  date        NOT NULL UNIQUE,
  content        text        NOT NULL,
  finding_count  int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
