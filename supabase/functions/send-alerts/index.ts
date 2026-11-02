// Every 15 minutes: send "Today is a good day for Oysters!" push alerts.
//
// Morning alerts go to users whose notify_local_minutes falls in the current
// 15-minute slot (Pacific time) and cover today. Evening alerts go at 7 p.m.
// to users with notify_evening_before and cover tomorrow. Each beach and
// species is sent at most once per day and kind (notifications_sent).
import {
  addDays,
  BEACH_SELECT,
  contextFromRow,
  localDateKey,
  localMinutes,
  pickAlert,
  prefsFromProfile,
  sentKey,
  type AlertKind,
  type BeachContext,
  type BeachRow,
  type DigRow,
  type Rating,
  type SpeciesId,
  type TideEvent,
  zonedTime,
} from "../../../packages/core/src/index.ts";
import { chunk, must, runJob } from "../_shared/db.ts";

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const SLOT = 15;
const EVENING_MINUTES = 19 * 60;

type Profile = {
  user_id: string;
  time_window: { kind: "daylight"; paddingMinutes: number } | { kind: "custom"; startMinutes: number; endMinutes: number };
  days_of_week: number[] | null;
  tide_overrides: Record<string, { idealTideFt?: number; marginalTideFt?: number }> | null;
  min_overlap_minutes: number | null;
  notify_min_rating: string;
  notify_local_minutes: number;
  notify_evening_before: boolean;
};

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

Deno.serve((req) =>
  runJob(req, "send-alerts", async (db) => {
    const url = new URL(req.url);
    // ?at=ISO lets an admin replay a slot; ?dry=1 builds alerts without sending.
    const now = url.searchParams.get("at") ? new Date(url.searchParams.get("at")!) : new Date();
    const dry = url.searchParams.get("dry") === "1";
    const today = localDateKey(now);
    const slot = Math.floor(localMinutes(now) / SLOT) * SLOT;

    const base = db.from("profiles").select("*").eq("notify_enabled", true);
    const morning: Profile[] = must(
      await base.gte("notify_local_minutes", slot).lt("notify_local_minutes", slot + SLOT),
    ) ?? [];
    const evening: Profile[] = slot === EVENING_MINUTES
      ? must(await db.from("profiles").select("*").eq("notify_enabled", true).eq("notify_evening_before", true)) ?? []
      : [];
    const jobs: { p: Profile; kind: AlertKind; forKey: string }[] = [
      ...morning.map((p) => ({ p, kind: "morning" as const, forKey: today })),
      ...evening.map((p) => ({ p, kind: "evening" as const, forKey: addDays(today, 1) })),
    ];
    if (jobs.length === 0) return { slot, users: 0, sent: 0 };

    const userIds = [...new Set(jobs.map((j) => j.p.user_id))];
    const [favBeaches, favSpecies, tokens, sentRows] = await Promise.all([
      db.from("favorite_beaches").select("user_id, bidn").in("user_id", userIds),
      db.from("favorite_species").select("user_id, species_id").in("user_id", userIds),
      db.from("push_tokens").select("user_id, token").in("user_id", userIds),
      db.from("notifications_sent").select("user_id, for_date, bidn, species_id, kind").in("user_id", userIds)
        .in("for_date", [today, addDays(today, 1)]),
    ]);
    const group = <T extends { user_id: string }, V>(rows: T[] | null, pick: (r: T) => V) => {
      const m = new Map<string, V[]>();
      for (const r of rows ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), pick(r)]);
      return m;
    };
    const beachesOf = group(must(favBeaches), (r) => r.bidn as string);
    const speciesOf = group(must(favSpecies), (r) => r.species_id as SpeciesId);
    const tokensOf = group(must(tokens), (r) => r.token as string);
    const sentOf = group(must(sentRows), (r) => `${r.for_date}|${r.kind}|${sentKey(r.bidn, r.species_id)}`);

    // Beaches, digs and tides for everything anyone here has starred.
    const bidns = [...new Set([...beachesOf.values()].flat())];
    const rows: BeachRow[] = [];
    for (const part of chunk(bidns, 200)) {
      rows.push(...(must(await db.from("beaches").select(BEACH_SELECT).in("bidn", part)) as unknown as BeachRow[]));
    }
    const digs = must(
      await db.from("razor_digs").select("dig_date, razor_beach").eq("cancelled", false).gte("dig_date", today),
    ) as DigRow[];
    const contexts = new Map<string, BeachContext>();
    const stationOf = new Map<string, string>();
    for (const r of rows) {
      const ctx = contextFromRow(r, digs);
      if (ctx) contexts.set(r.bidn, ctx);
      if (r.station_id) stationOf.set(r.bidn, r.station_id);
    }
    const tides = new Map<string, TideEvent[]>();
    const from = zonedTime(addDays(today, -1), 0).toISOString();
    const to = zonedTime(addDays(today, 3), 0).toISOString();
    for (const id of new Set(stationOf.values())) {
      const t = must(
        await db.from("tide_events").select("at, height_ft, kind").eq("station_id", id).gte("at", from).lt("at", to)
          .order("at"),
      ) ?? [];
      tides.set(id, t.map((e) => ({ time: new Date(e.at), heightFt: Number(e.height_ft), type: e.kind as "H" | "L" })));
    }

    const messages: { to: string; title: string; body: string; data: Record<string, string>; channelId: string }[] = [];
    const sent: { user_id: string; for_date: string; bidn: string; species_id: string; kind: AlertKind }[] = [];
    for (const { p, kind, forKey } of jobs) {
      const to = tokensOf.get(p.user_id) ?? [];
      if (to.length === 0) continue;
      const already = new Set(
        (sentOf.get(p.user_id) ?? []).filter((k) => k.startsWith(`${forKey}|${kind}|`)).map((k) => k.split("|")[2]),
      );
      const alert = pickAlert(
        {
          favoriteBeaches: beachesOf.get(p.user_id) ?? [],
          favoriteSpecies: speciesOf.get(p.user_id) ?? [],
          prefs: prefsFromProfile(p as Parameters<typeof prefsFromProfile>[0]),
          minRating: (["great", "good", "marginal"].includes(p.notify_min_rating) ? p.notify_min_rating : "good") as Rating,
        },
        contexts,
        (bidn) => tides.get(stationOf.get(bidn) ?? ""),
        forKey,
        today,
        kind,
        already,
      );
      if (!alert) continue;
      for (const token of to) {
        messages.push({
          to: token,
          title: alert.title,
          body: alert.body,
          data: { bidn: alert.bidn, date: forKey },
          channelId: "alerts",
        });
      }
      for (const pick of alert.picks) {
        sent.push({ user_id: p.user_id, for_date: forKey, bidn: pick.beach.bidn, species_id: pick.score.speciesId, kind });
      }
    }

    if (dry) return { slot, users: jobs.length, messages, dry: true };

    // Expo accepts up to 100 messages a request. Drop tokens Expo says are dead.
    let delivered = 0;
    const dead: string[] = [];
    for (const batch of chunk(messages, 100)) {
      const res = await fetch(EXPO_PUSH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`Expo push HTTP ${res.status}: ${await res.text()}`);
      const { data } = (await res.json()) as { data: Ticket[] };
      data.forEach((t, i) => {
        if (t.status === "ok") delivered++;
        else if (t.details?.error === "DeviceNotRegistered") dead.push(batch[i].to);
      });
    }
    if (dead.length) must(await db.from("push_tokens").delete().in("token", dead));
    if (sent.length) must(await db.from("notifications_sent").upsert(sent, { ignoreDuplicates: true }));
    return { slot, users: jobs.length, messages: messages.length, delivered, deadTokens: dead.length };
  })
);

