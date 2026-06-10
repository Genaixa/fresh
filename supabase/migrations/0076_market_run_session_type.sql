-- Distinguish between old "market buy" sessions and new "market run" sessions
-- so both pages can coexist on the same day without sharing state.
ALTER TABLE market_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'market';

ALTER TABLE market_sessions
  DROP CONSTRAINT IF EXISTS market_sessions_session_type_check;

ALTER TABLE market_sessions
  ADD CONSTRAINT market_sessions_session_type_check
  CHECK (session_type IN ('market', 'run'));
