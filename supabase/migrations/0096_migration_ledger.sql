-- ═══════════════════════════════════════════════════════════════════════════════
-- 0096 — Migration ledger (drift safety net)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migrations here are applied by hand (not via the Supabase CLI, so
-- supabase_migrations.schema_migrations stays empty and there's no record of what's
-- been run). This lightweight ledger records each applied migration filename, so a
-- check can flag any file that exists but was never applied (or vice-versa).
--
-- Going forward, apply migrations with scripts/apply-migration.sh, which records
-- into this table automatically. scripts/check-migrations.sh reports drift.

CREATE TABLE IF NOT EXISTS schema_migration_log (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
