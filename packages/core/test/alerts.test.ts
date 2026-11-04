import { describe, expect, it } from "vitest";
import dohFixture from "./fixtures/doh-beaches.json";
import {
  contextFromRow,
  DEFAULT_PREFS,
  parseDohQuery,
  pickAlert,
  prefsFromProfile,
  sentKey,
  speciesForRegion,
  zonedTime,
  type AlertUser,
  type BeachContext,
  type BeachRow,
  type TideEvent,
} from "../src/index.ts";

const [, mapleDoh] = parseDohQuery(dohFixture).beaches;
const maple: BeachContext = {
  bidn: mapleDoh.bidn,
  name: "Maple Hollow",
  location: mapleDoh.midpoint!,
  region: "puget_sound",
  doh: mapleDoh,
  razorBeach: null,
  razorDigDates: [],
};

// One midday low per day, getting lower: 2.0, 1.4, 0.8, 0.2, -0.4, -1.0, -1.6 ft.
const week: TideEvent[] = Array.from({ length: 7 }, (_, i) => ({
  time: zonedTime(`2026-11-0${i + 2}`, 12 * 60),
  heightFt: 2 - i * 0.6,
  type: "L" as const,
}));

const beaches = new Map([[maple.bidn, maple]]);
const user: AlertUser = {
  favoriteBeaches: [maple.bidn],
  favoriteSpecies: ["oyster", "manila_clam", "razor_clam"],
  prefs: DEFAULT_PREFS,
  minRating: "good",
};

describe("pickAlert", () => {
  it("sends nothing on a day below the user's bar", () => {
    expect(pickAlert(user, beaches, () => week, "2026-11-02", "2026-11-02", "morning")).toBeNull();
  });

  it("writes the best pick as the title and counts the rest", () => {
    const a = pickAlert(user, beaches, () => week, "2026-11-07", "2026-11-07", "morning")!;
    expect(a.title).toBe("Today is a great day for Manila clams!");
    expect(a.body).toBe("Maple Hollow: low -1.0 ft at 12:00 PM. 1 more good pick in the app.");
    expect(a.picks.map((p) => p.score.speciesId).sort()).toEqual(["manila_clam", "oyster"]);
    expect(a.bidn).toBe(maple.bidn);
  });

  it("says tomorrow for the evening alert", () => {
    const a = pickAlert(user, beaches, () => week, "2026-11-07", "2026-11-06", "evening")!;
    expect(a.title.startsWith("Tomorrow is")).toBe(true);
  });

  it("skips picks already sent", () => {
    const sent = new Set([sentKey(maple.bidn, "manila_clam"), sentKey(maple.bidn, "oyster")]);
    expect(pickAlert(user, beaches, () => week, "2026-11-07", "2026-11-07", "morning", sent)).toBeNull();
  });

  it("respects the user's days of the week", () => {
    const weekdaysOnly = { ...user, prefs: { ...DEFAULT_PREFS, daysOfWeek: [1, 2, 3, 4, 5] } };
    // 2026-11-07 is a Saturday.
    expect(pickAlert(weekdaysOnly, beaches, () => week, "2026-11-07", "2026-11-07", "morning")).toBeNull();
  });
});

describe("rows", () => {
  it("keeps only species of the beach's shore", () => {
    expect(speciesForRegion("puget_sound", ["razor_clam", "oyster"])).toEqual(["oyster"]);
  });

  it("maps a beach row to a scoring context", () => {
    const row: BeachRow = {
      bidn: "270440",
      doh_beach_id: 1,
      name: "Twin Harbors",
      waterbody: null,
      county: "Grays Harbor",
      growing_area: null,
      owner: null,
      info_link: null,
      region: "pacific_coast",
      razor_beach: "Twin Harbors",
      lat: 46.8,
      lng: -124.1,
      station_id: "9441102",
      station_km: 3.2,
      tide_stations: { name: "Westport" },
      beach_status: null,
      beach_species: [{ species_id: "mussel", abundance: "absent" }],
    };
    const ctx = contextFromRow(row, [
      { dig_date: "2026-11-05", razor_beach: "Twin Harbors" },
      { dig_date: "2026-11-05", razor_beach: "Mocrocks" },
    ])!;
    expect(ctx.doh).toBeNull();
    expect(ctx.razorDigDates).toEqual(["2026-11-05"]);
    expect(ctx.absentSpecies).toEqual(["mussel"]);
    expect(contextFromRow({ ...row, lat: null }, [])).toBeNull();
  });

  it("reads prefs from a profile row", () => {
    expect(
      prefsFromProfile({
        time_window: { kind: "custom", startMinutes: 1080, endMinutes: 1320 },
        days_of_week: null,
        tide_overrides: {},
        min_overlap_minutes: 30,
      }),
    ).toEqual({ window: { kind: "custom", startMinutes: 1080, endMinutes: 1320 }, tideOverrides: {}, minOverlapMinutes: 30 });
  });
});
