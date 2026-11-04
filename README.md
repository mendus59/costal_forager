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
| `supabase/functions` | Scheduled sync jobs and the `send-alerts` push job (Deno edge functions). |
| `supabase/cron.sql` | Schedules every job with `pg_cron` + `pg_net`. |
| `scripts/deploy-supabase.sh` | One-shot backend deploy: schema, seed, functions, first sync, schedules. |
| `apps/mobile` | Expo app (iOS, Android, web): Today, Beaches, Beach detail, Settings, home-screen widget. |

## Data sources

| Data | Source | Job | Schedule |
| --- | --- | --- | --- |
| Beaches, safe-to-harvest status, species closures, clam/oyster seasons | WA DOH Recreational Shellfish Beaches ArcGIS layer | `sync-doh` | Hourly |
| Tide stations and high/low predictions (ft MLLW) | NOAA CO-OPS Data and Metadata APIs | `sync-tides` | Daily (40 stations per run) |
| Razor clam dig days | WDFW razor clam page (no feed; parsed) | `sync-razor-digs` | Daily |
| Which species are common on each beach | WDFW beach page "Harvest profile" (parsed) | `sync-beach-profiles` | Every 30 min, 25 beaches a batch |
| Sunrise and sunset | Computed in `packages/core/src/sun.ts` | none | n/a |
| Good-day push alerts | Users' favorites and settings + the tables above, sent with the Expo push API | `send-alerts` | Every 15 min |

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
npx expo start          # press w for web
npx expo export --platform web   # static single-page build in dist/
```

The app reads from Supabase and falls back to the DOH layer and NOAA directly
when the backend is unreachable (razor clam digs and harvest profiles need the
backend). Everything is cached on the device, so it opens offline.

There is no sign-in. On first launch the app creates an anonymous Supabase
account for the install, which backs up favorites and settings and owns the
push token for alerts. Data does not move between devices and is lost if the
app is deleted; a later "Sign in with Apple/Google" can link to the same
anonymous account to keep it.

Push alerts, the home-screen widget and background refresh need a
**development build** (they don't run in Expo Go):

```sh
npm i -g eas-cli
cd apps/mobile
eas init                       # creates the EAS project and writes its projectId to app.json
eas build --profile development --platform android   # or ios
```

* **iOS** needs an Apple Developer account (push certificates, the widget
  extension and the `group.com.mendus59.coastalforager` App Group). EAS sets
  these up on the first build.
* **Android** push needs an FCM key uploaded to EAS
  (`eas credentials`, then "Google Service Account Key for FCM V1").
* The widget ("Shellfishing day", small and medium) shows today's best rating
  across favorite beaches and species. iOS gets a week of entries that roll
  over at midnight; Android gets a snapshot, refreshed by a background task
  every few hours and whenever the app opens.

#### Android APK without an Expo account

The **Android APK** workflow (`.github/workflows/android-apk.yml`) runs
`expo prebuild` and Gradle on every push to `main` that touches the app, or
from Actions > Android APK > Run workflow. The APK is published to the
`android-latest` pre-release on GitHub; open that page on the phone, download
`coastal-forager.apk` and allow installs from the browser when Android asks.
It is signed with the template debug key, so new builds install over old ones,
but it can't go to the Play Store. The widget, background refresh and local
data work in it; push alerts don't until `eas init` adds a project ID and an
FCM key is set up.

To build locally (needs the Android SDK and JDK 17+):

```sh
cd apps/mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

### Supabase

Project `sngnpyvxufllutqrwqjw`. The app has its URL and anon key built in
(`apps/mobile/lib/supabase.ts`; `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` override them). The anon key is public by
design; row-level security protects user data.

Deploy everything with:

```sh
SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... \
SUPABASE_SERVICE_ROLE_KEY=... scripts/deploy-supabase.sh
```

It links the project, applies migrations, loads `supabase/seed.sql`, deploys
the five functions, runs the first `sync-doh`, `sync-tides` and
`sync-razor-digs`, stores `project_url` and `service_role_key` in Vault and
runs `supabase/cron.sql` to schedule the jobs. The functions only accept the
service role key as a bearer token. `send-alerts` also takes `?dry=1` to
build alerts without sending, and `?at=<ISO time>` to replay a slot.

Or run the **Deploy Supabase** GitHub Action (Actions > Deploy Supabase >
Run workflow), which reads those three values from the repository secrets,
runs the script above and then `scripts/set-auth-config.sh`, which turns on
anonymous sign-ins (Authentication > Sign In / Providers > "Allow anonymous
sign-ins"). No email setup is needed.
