// Runs often in small batches: read each beach's WDFW "Harvest profile" and
// record which species are common there. Oldest-checked beaches go first, so
// every beach is refreshed every few days without hammering wdfw.wa.gov.
import {
  extractHarvestProfile,
  htmlToText,
  parseHarvestProfile,
  WDFW_BEACH_PAGE,
} from "../../../packages/core/src/index.ts";
import { getText, must, runJob } from "../_shared/db.ts";

const BATCH = 25;
const PAUSE_MS = 1000;

Deno.serve((req) =>
  runJob(req, "sync-beach-profiles", async (db) => {
    const beaches = must(
      await db.rpc("beaches_needing_profile", { batch_size: BATCH }),
    ) as { bidn: string }[];
    let parsed = 0;
    const missing: string[] = [];
    for (const { bidn } of beaches) {
      try {
        const text = htmlToText(await getText(WDFW_BEACH_PAGE(bidn)));
        const profile = extractHarvestProfile(text);
        const species = profile ? parseHarvestProfile(profile) : {};
        const rows = Object.entries(species).map(([species_id, abundance]) => ({
          bidn,
          species_id,
          abundance,
          updated_at: new Date().toISOString(),
        }));
        if (rows.length) must(await db.from("beach_species").upsert(rows));
        else missing.push(bidn);
        parsed++;
      } catch {
        missing.push(bidn);
      }
      must(await db.from("beaches").update({ profile_checked_at: new Date().toISOString() }).eq("bidn", bidn));
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    return { checked: beaches.length, parsed, noProfile: missing };
  })
);
