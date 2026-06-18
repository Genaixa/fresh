#!/bin/bash
# Report drift between migration files on disk and the applied ledger.
# Exit 1 if any file is unapplied (useful in CI / pre-deploy).
set -euo pipefail

MIGDIR=/root/fresh/fresh-and-fruity/supabase/migrations
PSQL=(docker exec -i supabase_db_fresh-and-fruity psql -U postgres -d postgres -tA)

files=$(ls "$MIGDIR"/*.sql 2>/dev/null | xargs -n1 basename | sort)
logged=$(printf "SELECT filename FROM schema_migration_log;\n" | "${PSQL[@]}" | sort)

unapplied=$(comm -23 <(echo "$files") <(echo "$logged"))
missing=$(comm -13 <(echo "$files") <(echo "$logged"))

rc=0
if [ -n "$unapplied" ]; then
  echo "⚠ migration FILES not recorded as applied:"; echo "$unapplied" | sed 's/^/   /'; rc=1
fi
if [ -n "$missing" ]; then
  echo "⚠ ledger entries with NO file (deleted/renamed?):"; echo "$missing" | sed 's/^/   /'
fi
[ "$rc" = 0 ] && [ -z "$missing" ] && echo "✓ migrations in sync ($(echo "$files" | wc -l) files all applied)"
exit $rc
