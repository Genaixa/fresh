-- 0106_till_client_uuid.sql
-- Phase 2 (offline-first till): idempotency key for sales.
--
-- A sale is written to the till device's local store FIRST, then synced to the
-- server in the background. If the device is offline, the network drops
-- mid-sync, or a sync is retried, the SAME sale must land in the DB exactly
-- once — never lost, never duplicated. The client generates a `client_uuid`
-- per sale; the server upserts on it. This unique key is what makes a retry a
-- no-op instead of a double-charge in the books.

ALTER TABLE till_transactions ADD COLUMN IF NOT EXISTS client_uuid uuid;

CREATE UNIQUE INDEX IF NOT EXISTS till_transactions_client_uuid_key
  ON till_transactions (client_uuid) WHERE client_uuid IS NOT NULL;

COMMENT ON COLUMN till_transactions.client_uuid IS
  'Client-generated idempotency key for offline-first sync; a sale with an existing client_uuid is ignored (already recorded).';
