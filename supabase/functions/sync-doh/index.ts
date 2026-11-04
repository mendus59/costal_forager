// Hourly: pull every beach and its status from the DOH Recreational Shellfish Beaches layer.
import {
  beachPoint,
  dohQueryUrl,
  parseDohQuery,
  razorBeachFor,
  regionOf,
  type DohBeach,
} from "../../../packages/core/src/index.ts";
import { chunk, getJson, must, runJob } from "../_shared/db.ts";

function multiLine(b: DohBeach): string | null {
  const paths = b.paths.filter((p) => p.length >= 2);
  if (!paths.length) return null;
  const parts = paths.map((p) => `(${p.map(([x, y]) => `${x} ${y}`).join(", ")})`);
  return `SRID=4326;MULTILINESTRING(${parts.join(", ")})`;
}

Deno.serve((req) =>
  runJob(req, "sync-doh", async (db) => {
    const all: DohBeach[] = [];
    for (let offset = 0; ; offset += 2000) {
      const { beaches, more } = parseDohQuery(await getJson(dohQueryUrl(offset)));
      all.push(...beaches);
      if (!more || beaches.length === 0) break;
    }
    if (all.length < 50) throw new Error(`DOH returned only ${all.length} beaches; refusing to overwrite`);

    // A beach can appear as several line features; keep the first for identity, merge shapes.
    const byBidn = new Map<string, DohBeach>();
    for (const b of all) {
      const prev = byBidn.get(b.bidn);
      if (prev) prev.paths.push(...b.paths);
      else byBidn.set(b.bidn, { ...b, paths: [...b.paths] });
    }
    const beaches = [...byBidn.values()];
    const now = new Date().toISOString();

    for (const part of chunk(beaches, 200)) {
      must(
        await db.from("beaches").upsert(
          part.map((b) => {
            const p = beachPoint(b);
            return {
              bidn: b.bidn,
              doh_beach_id: b.dohBeachId,
              name: b.name,
              waterbody: b.waterbody,
              county: b.county,
              growing_area: b.growingArea,
              owner: b.owner,
              info_link: b.infoLink,
              region: regionOf(b),
              razor_beach: razorBeachFor(b.name),
              lat: p?.lat ?? null,
              lng: p?.lng ?? null,
              shape: multiLine(b),
              in_doh_layer: true,
              updated_at: now,
            };
          }),
        ),
      );
      must(
        await db.from("beach_status").upsert(
          part.map((b) => ({
            bidn: b.bidn,
            status: b.status,
            health_status: b.healthStatus,
            closed_for: b.closedFor,
            closed_for_text: b.closedForText,
            classification: b.classification,
            advisory: b.advisory,
            emergency: b.emergency,
            message: b.message,
            vibrio: b.vibrio,
            wdfw_open: b.wdfwOpen,
            season_text: b.seasonText,
            clam_season_start: b.clamSeason?.start ?? null,
            clam_season_end: b.clamSeason?.end ?? null,
            oyster_season_start: b.oysterSeason?.start ?? null,
            oyster_season_end: b.oysterSeason?.end ?? null,
            doh_updated_at: b.updatedAt?.toISOString() ?? null,
            synced_at: now,
          })),
        ),
      );
    }

    // Beaches that dropped out of the layer become "unknown", never "safe".
    // Every beach seen this run was stamped with `now`; anything older is gone.
    const gone = must(
      await db.from("beaches").select("bidn").eq("in_doh_layer", true).lt("updated_at", now),
    ) as { bidn: string }[];
    if (gone.length) {
      const ids = gone.map((g) => g.bidn);
      must(await db.from("beaches").update({ in_doh_layer: false }).in("bidn", ids));
      must(await db.from("beach_status").delete().in("bidn", ids));
    }

    const closed = beaches.filter((b) => b.status === "closed").length;
    return { beaches: beaches.length, closed, droppedOut: gone.length };
  })
);
