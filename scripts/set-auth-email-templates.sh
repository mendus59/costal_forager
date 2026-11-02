#!/usr/bin/env bash
# Makes Supabase Auth email a 6-digit code (not just a link) for sign-in.
# New users get the "Confirm signup" email and returning users get the
# "Magic Link" email, so both include {{ .Token }}. Needs curl and jq.
#
#   SUPABASE_ACCESS_TOKEN  personal access token
#   SUPABASE_PROJECT_REF   defaults to the Coastal Forager project
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-sngnpyvxufllutqrwqjw}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

BODY='<h2>Your Coastal Forager code</h2>
<p>Enter this code in the app to sign in:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>The code expires in one hour. If you did not ask for it, ignore this email.</p>'

payload=$(jq -n --arg body "$BODY" '{
  mailer_subjects_magic_link: "Your Coastal Forager sign-in code",
  mailer_templates_magic_link_content: $body,
  mailer_subjects_confirmation: "Your Coastal Forager sign-in code",
  mailer_templates_confirmation_content: $body
}')

res=$(curl -sS -w '\n%{http_code}' -X PATCH "https://api.supabase.com/v1/projects/${REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")
code=${res##*$'\n'}
body=${res%$'\n'*}
if [[ "$code" != 2* ]]; then
  echo "Updating auth email templates failed (HTTP $code): $body" >&2
  exit 1
fi
echo "$body" | jq '{mailer_subjects_magic_link, mailer_subjects_confirmation,
  magic_link_has_token: ((.mailer_templates_magic_link_content // "") | contains("{{ .Token }}")),
  confirmation_has_token: ((.mailer_templates_confirmation_content // "") | contains("{{ .Token }}"))}'
