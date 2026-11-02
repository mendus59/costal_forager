#!/usr/bin/env bash
# Makes Supabase Auth email a 6-digit code (not just a link) for sign-in.
# New users get the "Confirm signup" email and returning users get the
# "Magic Link" email, so both include {{ .Token }}. Needs curl and jq.
#
#   SUPABASE_ACCESS_TOKEN  personal access token
#   SUPABASE_PROJECT_REF   defaults to the Coastal Forager project
#   RESEND_API_KEY         optional; with EMAIL_FROM, sends auth email through
#   EMAIL_FROM             Resend SMTP (needed to edit templates on the free
#                          plan). EMAIL_FROM is an address on a domain verified
#                          in Resend, e.g. login@example.com
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

patch_auth() {
  local res
  res=$(curl -sS -w '\n%{http_code}' -X PATCH "https://api.supabase.com/v1/projects/${REF}/config/auth" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$1")
  code=${res##*$'\n'}
  body=${res%$'\n'*}
}

# SMTP goes first: Supabase only allows template edits once custom SMTP is on.
if [[ -n "${RESEND_API_KEY:-}" && -n "${EMAIL_FROM:-}" ]]; then
  echo "Using Resend SMTP, sending from $EMAIL_FROM"
  patch_auth "$(jq -n --arg pass "$RESEND_API_KEY" --arg from "$EMAIL_FROM" '{
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: $pass,
    smtp_admin_email: $from,
    smtp_sender_name: "Coastal Forager",
    rate_limit_email_sent: 30
  }')"
  if [[ "$code" != 2* ]]; then
    echo "Setting SMTP failed (HTTP $code): $body" >&2
    exit 1
  fi
fi

patch_auth "$payload"
if [[ "$code" == 400 && "$body" == *"custom SMTP"* ]]; then
  # Free projects on the default email sender cannot change templates.
  echo "::warning::Email templates not changed: set the RESEND_API_KEY and EMAIL_FROM secrets (or configure SMTP in the dashboard) and rerun. $body"
  exit 0
fi
if [[ "$code" != 2* ]]; then
  echo "Updating auth email templates failed (HTTP $code): $body" >&2
  exit 1
fi
echo "$body" | jq '{smtp_host, smtp_admin_email, mailer_subjects_magic_link, mailer_subjects_confirmation,
  magic_link_has_token: ((.mailer_templates_magic_link_content // "") | contains("{{ .Token }}")),
  confirmation_has_token: ((.mailer_templates_confirmation_content // "") | contains("{{ .Token }}"))}'
