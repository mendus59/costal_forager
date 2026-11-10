#!/usr/bin/env bash
# Deploys the backend to a Supabase project: schema, species seed, edge
# functions, then the first data sync. Needs Node (for the Supabase CLI), curl
# and jq. SQL files run through the Management API, so no database connection
# string is needed.
#
#   SUPABASE_ACCESS_TOKEN  personal access token (supabase.com/dashboard/account/tokens)
#   SUPABASE_DB_PASSWORD   the project's database password
#   SUPABASE_PROJECT_REF   defaults to the Coastal Forager project
#   SUPABASE_SERVICE_ROLE_KEY  optional; when set, runs the first syncs
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${SUPABASE_PROJECT_REF:-sngnpyvxufllutqrwqjw}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD}"
# Pinned: CLI v3 (2026-11-02) asks for confirmation before deploys and fails in CI.
SB="npx -y supabase@2.122.1"

# Runs SQL (an argument, or a file with -f) on the project via the Management API.
sql() {
  local q out
  if [[ "$1" == "-f" ]]; then q=$(cat "$2"); else q="$1"; fi
  out=$(jq -n --arg q "$q" '{query: $q}' \
    | curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
        -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" -d @-) \
    || { echo "SQL failed: ${out:0:500}" >&2; return 1; }
  echo "${out:0:300}"
}

$SB link --project-ref "$REF" --password "$SUPABASE_DB_PASSWORD"
$SB db push --linked --password "$SUPABASE_DB_PASSWORD"

echo "Loading seed"
sql -f supabase/seed.sql

$SB functions deploy sync-doh sync-tides sync-razor-digs sync-beach-profiles send-alerts --project-ref "$REF"

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  # The functions accept this key as a bearer token (see _shared/db.ts).
  $SB secrets set "JOB_KEY=${SUPABASE_SERVICE_ROLE_KEY}" --project-ref "$REF"
  URL="https://${REF}.supabase.co/functions/v1"
  # sync-tides caches 40 stations per call, so call it a few times up front.
  for job in sync-doh sync-tides sync-tides sync-tides sync-razor-digs; do
    echo "Running $job"
    curl -sS --fail-with-body --max-time 150 -X POST "$URL/$job" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
    echo
  done
  sql "select vault.create_secret('https://${REF}.supabase.co', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');"
  sql "select vault.create_secret('${SUPABASE_SERVICE_ROLE_KEY}', 'service_role_key') where not exists (select 1 from vault.secrets where name = 'service_role_key');"
  sql "select vault.update_secret(id, '${SUPABASE_SERVICE_ROLE_KEY}') from vault.secrets where name = 'service_role_key';"
  sql -f supabase/cron.sql
  echo "Scheduled jobs."
else
  echo "Set SUPABASE_SERVICE_ROLE_KEY to run the first syncs and schedule the jobs (supabase/cron.sql)."
fi

# Supabase's rls_disabled_in_public check: fail loudly if any table in the
# API schema still has row-level security off.
open_tables=$(sql "select coalesce(json_agg(c.relname), '[]'::json) as t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;" | jq -r '.[0].t | join(", ")')
if [[ -n "$open_tables" ]]; then
  echo "::error::Tables in public without row-level security: $open_tables"
  exit 1
fi
echo "Every table in public has row-level security."
