#!/usr/bin/env bash
set -euo pipefail
SQL_FILE="$(dirname "$0")/rls-coverage.sql"
if command -v psql >/dev/null 2>&1; then
  psql "${SUPABASE_TEST_DB_URL:?set SUPABASE_TEST_DB_URL}" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
else
  command -v docker >/dev/null 2>&1 || {
    echo "neither psql nor docker found; install psql, or start Docker and run 'supabase start'"; exit 1;
  }
  container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -1)"
  [ -n "$container" ] || { echo "no supabase_db_ container running; run 'supabase start'"; exit 1; }
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
fi
