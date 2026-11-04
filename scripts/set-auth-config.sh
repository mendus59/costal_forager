#!/usr/bin/env bash
# Turns on anonymous sign-ins for the project. The app creates an anonymous
# account on first launch (no email), which owns the user's synced favorites,
# settings and push token. Needs curl and jq.
#
#   SUPABASE_ACCESS_TOKEN  personal access token
#   SUPABASE_PROJECT_REF   defaults to the Coastal Forager project
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-sngnpyvxufllutqrwqjw}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

res=$(curl -sS -w '\n%{http_code}' -X PATCH "https://api.supabase.com/v1/projects/${REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"external_anonymous_users_enabled": true}')
code=${res##*$'\n'}
body=${res%$'\n'*}
if [[ "$code" != 2* ]]; then
  echo "Updating auth config failed (HTTP $code): $body" >&2
  exit 1
fi
echo "$body" | jq '{external_anonymous_users_enabled, rate_limit_anonymous_users}'
