#!/bin/bash
# Apply a Fresh migration AND record it in schema_migration_log.
# Usage: scripts/apply-migration.sh 0097_whatever.sql   (filename or full path)
# Dumps run inside the container (PG17) to avoid host pg client version skew.
set -euo pipefail

MIGDIR=/root/fresh/fresh-and-fruity/supabase/migrations
F="${1:?usage: apply-migration.sh <migration.sql>}"
[ -f "$F" ] || F="$MIGDIR/$(basename "$F")"
[ -f "$F" ] || { echo "migration not found: $1" >&2; exit 1; }
BN=$(basename "$F")

PSQL=(docker exec -i supabase_db_fresh-and-fruity psql -U postgres -d postgres -v ON_ERROR_STOP=1)

"${PSQL[@]}" < "$F"
printf "INSERT INTO schema_migration_log(filename) VALUES('%s') ON CONFLICT (filename) DO NOTHING;\n" "$BN" | "${PSQL[@]}" >/dev/null
echo "✓ applied + logged: $BN"
