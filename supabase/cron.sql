-- Schedules every job with pg_cron + pg_net. Run once in the SQL editor (or
-- via scripts/deploy-supabase.sh) after the functions are deployed.
-- Needs two Vault secrets:
--   project_url       https://<ref>.supabase.co
--   service_role_key  the project's service role key
-- e.g. select vault.create_secret('https://<ref>.supabase.co', 'project_url');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function invoke_job(job text) returns bigint
language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || job,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$$;
revoke all on function invoke_job(text) from public;

-- cron.schedule with a name replaces an existing job of that name.
select cron.schedule('sync-doh',            '7 * * * *',    $$ select invoke_job('sync-doh') $$);
select cron.schedule('sync-tides',          '0 9 * * *',    $$ select invoke_job('sync-tides') $$);
select cron.schedule('sync-razor-digs',     '0 15 * * *',   $$ select invoke_job('sync-razor-digs') $$);
select cron.schedule('sync-beach-profiles', '*/30 * * * *', $$ select invoke_job('sync-beach-profiles') $$);
select cron.schedule('send-alerts',         '*/15 * * * *', $$ select invoke_job('send-alerts') $$);
