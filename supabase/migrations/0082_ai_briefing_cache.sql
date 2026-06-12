-- Cache for AI golem briefings/tips so pages render instantly instead of
-- blocking on an LLM round-trip (market mornings = bad internet, every second
-- counts). Written by the service role in a background task; read by owners.
CREATE TABLE IF NOT EXISTS ai_briefings (
  key        text PRIMARY KEY,          -- e.g. market-run:2026-06-12
  briefing   text,
  tips       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads briefings" ON ai_briefings
  FOR SELECT USING (current_user_role() = 'owner');
