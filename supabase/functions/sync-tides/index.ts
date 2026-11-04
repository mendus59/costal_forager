// Weekly: refresh WA tide stations, map each beach to its nearest station, and
// cache about 13 months of high/low predictions for every station in use.
import {
  addDays,
  fetchPredictions,
  localDateKey,
  nearest,
  NOAA_STATIONS_URL,
  parseStations,
} from "../../../packages/core/src/index.ts";
import { chunk, getJson, must, runJob } from "../_shared/db.ts";

const DAYS_AHEAD = 400;

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
    let events = 0;
    const failed: string[] = [];
    for (const id of used) {
      try {
        const preds = await fetchPredictions(fetch, id, begin, end);
        for (const part of chunk(preds, 1000)) {
          must(
            await db.from("tide_events").upsert(
              part.map((e) => ({ station_id: id, at: e.time.toISOString(), height_ft: e.heightFt, kind: e.type })),
            ),
          );
        }
        events += preds.length;
      } catch (err) {
        failed.push(`${id}: ${err}`);
      }
    }
    must(await db.from("tide_events").delete().lt("at", new Date(Date.now() - 2 * 86400000).toISOString()));
    if (failed.length === used.size && used.size > 0) throw new Error(`All stations failed: ${failed[0]}`);
    return { stations: stations.length, stationsUsed: used.size, events, failed };
  })
);
