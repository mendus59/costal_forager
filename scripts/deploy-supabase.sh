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
SB="npx -y supabase@latest"

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
  URL="https://${REF}.supabase.co/functions/v1"
  for job in sync-doh sync-tides sync-razor-digs; do
    echo "Running $job"
    curl -sS -X POST "$URL/$job" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
    echo
  done
  sql "select vault.create_secret('https://${REF}.supabase.co', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');"
  sql "select vault.create_secret('${SUPABASE_SERVICE_ROLE_KEY}', 'service_role_key') where not exists (select 1 from vault.secrets where name = 'service_role_key');"
  sql -f supabase/cron.sql
  echo "Scheduled jobs."
else
  echo "Set SUPABASE_SERVICE_ROLE_KEY to run the first syncs and schedule the jobs (supabase/cron.sql)."
fi
