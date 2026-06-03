-- Allow multiple market sessions per day (for second/third market trips)
ALTER TABLE market_sessions DROP CONSTRAINT market_sessions_session_date_key;
-- Add trip_number so sessions are distinguishable within a day
ALTER TABLE market_sessions ADD COLUMN IF NOT EXISTS trip_number integer NOT NULL DEFAULT 1;
