// Daily: refresh WA tide stations, map each beach to its nearest station, and
// cache about 13 months of high/low predictions for the stations in use.
// NOAA starts answering 403 after a burst of requests, so each run fetches at
// most MAX_STATIONS stations (those whose cache runs out soonest), one year
// per request, with a pause between requests.
import {
  addDays,
  fetchPredictions,
  localDateKey,
  nearest,
  NOAA_STATIONS_URL,
  parseStations,
} from "../../../packages/core/src/index.ts";
import { chunk, getJson, must, runJob, USER_AGENT } from "../_shared/db.ts";

const DAYS_AHEAD = 400;
/** Refetch a station when its cache covers less than this many days ahead. */
const REFRESH_BELOW_DAYS = 330;
const MAX_STATIONS = 40;
const PAUSE_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with a User-Agent, a pause before each call and one retry on 403/429. */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    await sleep(attempt ? 5000 : PAUSE_MS);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if ((res.status !== 403 && res.status !== 429) || attempt >= 1) return res;
    await res.body?.cancel();
  }
}

Deno.serve((req) =>
  runJob(req, "sync-tides", async (db) => {
    const stations = parseStations(await getJson(NOAA_STATIONS_URL));
    if (!stations.length) throw new Error("NOAA returned no WA stations");
    must(
      await db.from("tide_stations").upsert(
        stations.map((s) => ({
          id: s.id,
          name: s.name,
          location: `SRID=4326;POINT(${s.lng} ${s.lat})`,
          station_type: s.type,
          reference_id: s.referenceId,
          updated_at: new Date().toISOString(),
        })),
      ),
    );

    const beaches = must(await db.from("beaches").select("bidn, lat, lng").not("lat", "is", null)) as {
      bidn: string;
      lat: number;
      lng: number;
    }[];
    const used = new Set<string>();
    for (const part of chunk(beaches, 200)) {
      const rows = part.map((b) => {
        const hit = nearest({ lat: b.lat, lng: b.lng }, stations)!;
        used.add(hit.item.id);
        return { bidn: b.bidn, station_id: hit.item.id, station_km: Math.round(hit.km * 10) / 10 };
      });
      for (const r of rows) {
        must(await db.from("beaches").update({ station_id: r.station_id, station_km: r.station_km }).eq("bidn", r.bidn));
      }
    }

    const today = localDateKey(new Date());
    const begin = addDays(today, -1);
    const end = addDays(today, DAYS_AHEAD);
    const refreshBefore = addDays(today, REFRESH_BELOW_DAYS);
    const cached = must(
      await db.from("tide_stations").select("id, predictions_until").in("id", [...used]),
    ) as { id: string; predictions_until: string | null }[];
    const until = new Map(cached.map((c) => [c.id, c.predictions_until]));
    const due = [...used]
      .filter((id) => !until.get(id) || until.get(id)! < refreshBefore)
      .sort((a, b) => (until.get(a) ?? "").localeCompare(until.get(b) ?? ""));
    const batch = due.slice(0, MAX_STATIONS);

    let events = 0;
    const failed: string[] = [];
    for (const id of batch) {
      try {
        const preds = await fetchPredictions(politeFetch, id, begin, end, 365);
        for (const part of chunk(preds, 1000)) {
          must(
            await db.from("tide_events").upsert(
              part.map((e) => ({ station_id: id, at: e.time.toISOString(), height_ft: e.heightFt, kind: e.type })),
            ),
          );
        }
        must(await db.from("tide_stations").update({ predictions_until: end }).eq("id", id));
        events += preds.length;
      } catch (err) {
        failed.push(`${id}: ${err}`);
      }
    }
    must(await db.from("tide_events").delete().lt("at", new Date(Date.now() - 2 * 86400000).toISOString()));
    if (batch.length > 0 && failed.length === batch.length) throw new Error(`All stations failed: ${failed[0]}`);
    return {
      stations: stations.length,
      stationsUsed: used.size,
      fetched: batch.length - failed.length,
      remaining: due.length - (batch.length - failed.length),
      events,
      failed,
    };
  })
);
