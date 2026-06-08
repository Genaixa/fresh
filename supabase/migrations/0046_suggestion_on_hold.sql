-- Allow price suggestions to be held (waiting for owner decision)
ALTER TYPE suggestion_status ADD VALUE IF NOT EXISTS 'on_hold';
