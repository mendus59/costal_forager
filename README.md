# Coastal Forager

Where and when to go shellfishing in Washington State. The app shows which
public beaches are safe and in season for each species, and finds the next
day when the tide is low enough during the hours you want to be out.

Research behind it (species, tide heights, beaches, data sources):
[docs/research.md](docs/research.md).

> Guidance only. Before you harvest, check the
> [DOH shellfish safety map](https://doh.wa.gov/shellfishsafety) or call the
> biotoxin hotline at 1-800-562-5632, and confirm the WDFW season.

## Layout

| Path | What it is |
| --- | --- |
| `packages/core` | Shared TypeScript: species table, NOAA/DOH/WDFW parsers, sun times, scoring and "next ideal day" search. Runs in Node, Deno and React Native. |
| `supabase/migrations` | Postgres + PostGIS schema with row-level security. |
| `supabase/seed.sql` | Species seed, generated from `packages/core/src/species.ts` (`npm run gen:seed`). |
| `supabase/functions` | Scheduled sync jobs (Deno edge functions). |
| `apps/mobile` | Expo app (iOS, Android, web): Today, Beaches, Beach detail, Settings. |

## Data sources

| Data | Source | Job | Schedule |
| --- | --- | --- | --- |
| Beaches, safe-to-harvest status, species closures, clam/oyster seasons | WA DOH Recreational Shellfish Beaches ArcGIS layer | `sync-doh` | Hourly |
| Tide stations and high/low predictions (ft MLLW) | NOAA CO-OPS Data and Metadata APIs | `sync-tides` | Weekly |
| Razor clam dig days | WDFW razor clam page (no feed; parsed) | `sync-razor-digs` | Daily |
| Which species are common on each beach | WDFW beach page "Harvest profile" (parsed) | `sync-beach-profiles` | Every 30 min, 25 beaches a batch |
| Sunrise and sunset | Computed in `packages/core/src/sun.ts` | none | n/a |

## How a day is rated

1. **Gate.** The WDFW season must be open on that date, DOH must not have the
   species closed, and razor clams need an announced dig. Failing days show as
   **Closed**, never as a low score.
2. **Tide fit.** 1 at or below the species' ideal low tide, 0 at or above its
   marginal height, linear in between. Users can override both per species.
3. **Window fit.** Share of the harvest window around low tide that falls in
   the user's hours: daylight by default (sunrise − 1 h to sunset + 1 h), or a
   custom range such as 10am–2pm or 6pm–10pm (ranges may cross midnight).

`score = tideFit × windowFit` → Great ≥ 0.8, Good ≥ 0.5, Marginal ≥ 0.2, else Poor.

## Development

```sh
npm install
npm test            # vitest, packages/core
npm run typecheck
npm run gen:seed    # after editing species.ts
```

### App

```sh
cd apps/mobile
npx expo start          # press w for web, or scan the QR code with Expo Go
npx expo export --platform web   # static single-page build in dist/
```

Until the backend is connected, the app reads the DOH layer and NOAA tides
directly and caches them on the device. Favorites and settings are stored
on the device too. Razor clam dig days need the backend's `sync-razor-digs`
job, so razor clams show as closed in the app until then.

### Supabase

```sh
supabase link --project-ref <ref>
supabase db push                      # applies migrations
psql "$DATABASE_URL" -f supabase/seed.sql
supabase functions deploy sync-doh sync-tides sync-razor-digs sync-beach-profiles
```

The sync functions only accept the service role key as a bearer token.
Schedule them with `pg_cron` and `pg_net` (SQL editor; store the key in Vault
as `service_role_key`):

```sql
select cron.schedule('sync-doh', '7 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/sync-doh',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')));
$$);
-- Repeat with: sync-tides '0 9 * * 1', sync-razor-digs '0 15 * * *',
-- sync-beach-profiles '*/30 * * * *'
```

Run `sync-doh` first (it creates the beaches), then `sync-tides`.
