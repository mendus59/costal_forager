-- Step 3: accounts, synced settings, push alerts.

alter table profiles add column if not exists min_overlap_minutes smallint not null default 45;
alter table profiles alter column notify_enabled set default false;  -- the app turns it on with a push token

-- favorite_beaches.bidn must not block a sync when a beach drops out of the
-- DOH layer for a while, so keep the favorite and drop the foreign key.
alter table favorite_beaches drop constraint if exists favorite_beaches_bidn_fkey;

-- Create the profile row on sign-up so the app can always update it.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- A device token moves to whoever signs in on that device.
create or replace function claim_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into push_tokens (token, user_id, platform, last_seen_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;
revoke all on function claim_push_token(text, text) from public, anon;
grant execute on function claim_push_token(text, text) to authenticated;

-- The evening-before alert and the morning alert for the same day are
-- separate sends.
alter table notifications_sent add column if not exists kind text not null default 'morning'
  check (kind in ('morning', 'evening'));
alter table notifications_sent drop constraint if exists notifications_sent_pkey;
alter table notifications_sent add primary key (user_id, for_date, bidn, species_id, kind);
