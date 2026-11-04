#!/usr/bin/env bash
# Deploys the backend to a Supabase project: schema, species seed, edge
# functions, then the first data sync. Needs the Supabase CLI and psql.
#
#   SUPABASE_ACCESS_TOKEN  personal access token (supabase.com/dashboard/account/tokens)
#   SUPABASE_DB_PASSWORD   the project's database password
#   SUPABASE_DB_URL        Session pooler connection string (dashboard > Connect)
#   SUPABASE_PROJECT_REF   defaults to the Coastal Forager project
#   SUPABASE_SERVICE_ROLE_KEY  optional; when set, runs the first syncs
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${SUPABASE_PROJECT_REF:-sngnpyvxufllutqrwqjw}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD}"
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (dashboard > Connect > Session pooler)}"
SB="npx -y supabase@latest"

$SB link --project-ref "$REF" --password "$SUPABASE_DB_PASSWORD"
$SB db push --password "$SUPABASE_DB_PASSWORD"

DB_URL="$SUPABASE_DB_URL"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql

$SB functions deploy sync-doh sync-tides sync-razor-digs sync-beach-profiles send-alerts --project-ref "$REF"

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  URL="https://${REF}.supabase.co/functions/v1"
  for job in sync-doh sync-tides sync-razor-digs; do
    echo "Running $job"
    curl -sS -X POST "$URL/$job" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
    echo
  done
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "select vault.create_secret('https://${REF}.supabase.co', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');" \
    -c "select vault.create_secret('${SUPABASE_SERVICE_ROLE_KEY}', 'service_role_key') where not exists (select 1 from vault.secrets where name = 'service_role_key');"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/cron.sql
  echo "Scheduled jobs."
else
  echo "Set SUPABASE_SERVICE_ROLE_KEY to run the first syncs and schedule the jobs (supabase/cron.sql)."
fi
