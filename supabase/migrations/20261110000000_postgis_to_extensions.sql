-- Supabase flagged rls_disabled_in_public: anyone with the project URL could
-- read and change a table in the public schema that has no row-level
-- security. Every table this app creates already has RLS. The one that
-- does not is spatial_ref_sys, which PostGIS adds to whichever schema it is
-- installed in. It belongs to the extension, so RLS cannot be turned on for
-- it; Supabase's fix is to move PostGIS into the extensions schema, which the
-- API does not expose.
--
-- PostGIS cannot be moved in place, so this drops it (taking the geography
-- columns with it) and reinstalls it in extensions, keeping the column data.

create schema if not exists extensions;

do $$
begin
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis' and n.nspname = 'public'
  ) then
    return;
  end if;

  -- Keep the spatial data as plain values while PostGIS is gone.
  alter table tide_stations add column _lat double precision, add column _lng double precision;
  update tide_stations set _lat = st_y(location::geometry), _lng = st_x(location::geometry);
  alter table beaches add column _shape text;
  update beaches set _shape = st_asewkt(shape) where shape is not null;

  drop extension postgis cascade;  -- drops tide_stations.location, beaches.location/shape and their index
  create extension postgis schema extensions;

  alter table tide_stations add column location extensions.geography(Point, 4326);
  update tide_stations
    set location = extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography;
  alter table tide_stations alter column location set not null;
  alter table tide_stations drop column _lat, drop column _lng;

  alter table beaches
    add column location extensions.geography(Point, 4326) generated always as (
      case when lat is null or lng is null then null
      else extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography end
    ) stored,
    add column shape extensions.geography(MultiLineString, 4326);
  update beaches set shape = _shape::extensions.geography where _shape is not null;
  alter table beaches drop column _shape;
end $$;

create index if not exists beaches_location_idx on beaches using gist (location);

-- PostGIS functions now live in extensions, so pin the search path.
create or replace function beaches_near(at_lat double precision, at_lng double precision, radius_km double precision default 50)
returns table (bidn text, name text, km double precision)
language sql stable set search_path = public, extensions as $$
  select b.bidn, b.name, st_distance(b.location, st_setsrid(st_makepoint(at_lng, at_lat), 4326)::geography) / 1000 as km
  from beaches b
  where b.location is not null
    and st_dwithin(b.location, st_setsrid(st_makepoint(at_lng, at_lat), 4326)::geography, radius_km * 1000)
  order by km
$$;

-- Safety net: any other table in public without RLS (for example one made in
-- the dashboard) gets RLS with no policies, so the API cannot reach it until
-- someone writes policies for it. The service role still can.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
      and pg_get_userbyid(c.relowner) = current_user
  loop
    raise notice 'enabling row level security on public.%', t.relname;
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;
