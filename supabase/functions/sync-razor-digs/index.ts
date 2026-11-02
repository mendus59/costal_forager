// Daily: read announced razor clam digs from WDFW's razor clam page.
// WDFW publishes no feed, so this parses the page text. Admins can also insert
// rows into razor_digs directly; this job only adds or updates, never deletes.
import { htmlToText, parseRazorDigs, WDFW_RAZOR_PAGE } from "../../../packages/core/src/index.ts";
import { getText, must, runJob } from "../_shared/db.ts";

Deno.serve((req) =>
  runJob(req, "sync-razor-digs", async (db) => {
    const text = htmlToText(await getText(WDFW_RAZOR_PAGE));
    const digs = parseRazorDigs(text, new Date());
    const rows = digs.flatMap((d) =>
      d.beaches.map((beach) => ({
        dig_date: d.date,
        razor_beach: beach,
        low_at: d.lowTime?.toISOString() ?? null,
        low_tide_ft: d.lowTideFt,
        source_url: WDFW_RAZOR_PAGE,
      })),
    );
    // The page can list the same beach and date twice (e.g. a tentative and a
    // confirmed line); one upsert cannot touch a row twice, so keep the last.
    const unique = [...new Map(rows.map((r) => [`${r.dig_date}|${r.razor_beach}`, r])).values()];
    if (unique.length) must(await db.from("razor_digs").upsert(unique));
    return { digs: digs.length, rows: unique.length, dates: digs.map((d) => d.date) };
  })
);
