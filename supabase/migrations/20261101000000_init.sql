-- Coastal Forager: initial schema.
-- Reference data is written only by the sync functions (service role).
-- User data is protected by row-level security.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Reference data

create table species (
  id text primary key,
  name text not null,
  plural text not null,
  ideal_tide_ft numeric not null,
  marginal_tide_ft numeric not null,
  tide_source text not null check (tide_source in ('wdfw', 'estimate')),
  hours_before_low numeric not null,
  hours_after_low numeric not null,
  season_group text not null,
  region text not null check (region in ('puget_sound', 'pacific_coast', 'both')),
  daily_limit text not null,
  min_size text,
  notes text not null default ''
);

create table tide_stations (
  id text primary key,                 -- NOAA station id
  name text not null,
  location geography(Point, 4326) not null,
  station_type text not null,          -- R harmonic, S subordinate
  reference_id text,
  updated_at timestamptz not null default now()
);

create table beaches (
  bidn text primary key,               -- WDFW 6-digit beach id (DOH BIDN)
  doh_beach_id integer,
  name text not null,
  waterbody text,
  county text,
  growing_area text,
  owner text,
  info_link text,
  region text not null check (region in ('puget_sound', 'pacific_coast')),
  razor_beach text,                    -- Long Beach, Twin Harbors, Copalis, Mocrocks, Kalaloch
  lat double precision,
  lng double precision,
  location geography(Point, 4326) generated always as (
    case when lat is null or lng is null then null
    else st_setsrid(st_makepoint(lng, lat), 4326)::geography end
  ) stored,
  shape geography(MultiLineString, 4326),
  station_id text references tide_stations (id),
  station_km numeric,
  in_doh_layer boolean not null default true,
  profile_checked_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(waterbody, '') || ' ' || coalesce(county, ''))
  ) stored,
  updated_at timestamptz not null default now()
);
create index beaches_location_idx on beaches using gist (location);
create index beaches_search_idx on beaches using gin (search);

-- Latest DOH status per beach (one row per beach, overwritten by sync-doh).
create table beach_status (
  bidn text primary key references beaches (bidn) on delete cascade,
  status text not null,                -- open, closed, conditional, unclassified, unknown
  health_status text not null,
  closed_for jsonb not null,           -- "all" or ["oyster", ...]
  closed_for_text text not null default '',
  classification text,
  advisory text,
  emergency text,
  message text,
  vibrio boolean not null default false,
  wdfw_open smallint,
  season_text text not null default '',
  clam_season_start date,
  clam_season_end date,
  oyster_season_start date,
  oyster_season_end date,
  doh_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Species WDFW's harvest profile mentions for a beach.
create table beach_species (
  bidn text references beaches (bidn) on delete cascade,
  species_id text references species (id),
  abundance text not null check (abundance in ('abundant', 'present', 'scarce', 'absent')),
  source text not null default 'wdfw_profile',
  updated_at timestamptz not null default now(),
  primary key (bidn, species_id)
);

create table tide_events (
  station_id text references tide_stations (id) on delete cascade,
  at timestamptz not null,
  height_ft numeric not null,
  kind char(1) not null check (kind in ('H', 'L')),
  primary key (station_id, at)
);

create table razor_digs (
  dig_date date not null,
  razor_beach text not null,
  low_at timestamptz,
  low_tide_ft numeric,
  source_url text,
  announced_at timestamptz not null default now(),
  cancelled boolean not null default false,
  primary key (dig_date, razor_beach)
);

create table sync_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb
);

-- Reference data is public read-only.
alter table species enable row level security;
alter table tide_stations enable row level security;
alter table beaches enable row level security;
alter table beach_status enable row level security;
alter table beach_species enable row level security;
alter table tide_events enable row level security;
alter table razor_digs enable row level security;
alter table sync_runs enable row level security;

create policy "public read" on species for select using (true);
create policy "public read" on tide_stations for select using (true);
create policy "public read" on beaches for select using (true);
create policy "public read" on beach_status for select using (true);
create policy "public read" on beach_species for select using (true);
create policy "public read" on tide_events for select using (true);
create policy "public read" on razor_digs for select using (true);

-- ---------------------------------------------------------------------------
-- User data

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- {"kind":"daylight","paddingMinutes":60} or {"kind":"custom","startMinutes":600,"endMinutes":840}
  time_window jsonb not null default '{"kind":"daylight","paddingMinutes":60}',
  days_of_week smallint[],             -- null = every day; 0 = Sunday
  tide_overrides jsonb not null default '{}',
  notify_enabled boolean not null default true,
  notify_min_rating text not null default 'good',
  notify_local_minutes smallint not null default 420,   -- 7:00 a.m.
  notify_evening_before boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table favorite_beaches (
  user_id uuid references auth.users (id) on delete cascade,
  bidn text references beaches (bidn) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bidn)
);

create table favorite_species (
  user_id uuid references auth.users (id) on delete cascade,
  species_id text references species (id),
  primary key (user_id, species_id)
);

create table push_tokens (
  token text primary key,              -- Expo push token
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table notifications_sent (
  user_id uuid references auth.users (id) on delete cascade,
  for_date date not null,
  bidn text not null,
  species_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, for_date, bidn, species_id)
);

alter table profiles enable row level security;
alter table favorite_beaches enable row level security;
alter table favorite_species enable row level security;
alter table push_tokens enable row level security;
alter table notifications_sent enable row level security;

create policy "own rows" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on favorite_beaches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on favorite_species for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on notifications_sent for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Search helpers

-- Beaches near a point, nearest first.
-- (Parameters are prefixed so they cannot be confused with the lat/lng columns.)
create or replace function beaches_near(at_lat double precision, at_lng double precision, radius_km double precision default 50)
returns table (bidn text, name text, km double precision)
language sql stable as $$
  select b.bidn, b.name, st_distance(b.location, st_setsrid(st_makepoint(at_lng, at_lat), 4326)::geography) / 1000 as km
  from beaches b
  where b.location is not null
    and st_dwithin(b.location, st_setsrid(st_makepoint(at_lng, at_lat), 4326)::geography, radius_km * 1000)
  order by km
$$;

-- Beaches whose WDFW harvest profile is oldest (or never) checked.
create or replace function beaches_needing_profile(batch_size integer default 25)
returns table (bidn text)
language sql stable as $$
  select b.bidn from beaches b
  where b.in_doh_layer
  order by b.profile_checked_at nulls first, b.bidn
  limit batch_size
$$;
