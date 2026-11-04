import { describe, expect, it } from "vitest";
import noaaFixture from "./fixtures/noaa-seattle-2026-11-01.json";
import dohFixture from "./fixtures/doh-beaches.json";
import {
  bestOfDay,
  gate,
  nextIdealDays,
  notificationText,
  parseDohQuery,
  parsePredictions,
  ratingFor,
  scoreDay,
  tideFit,
  zonedTime,
  DEFAULT_PREFS,
  type BeachContext,
  type DohBeach,
  type TideEvent,
} from "../src/index.ts";

const tides = parsePredictions(noaaFixture);
const [potlatchDoh, mapleDoh] = parseDohQuery(dohFixture).beaches;

function context(b: DohBeach, extra: Partial<BeachContext> = {}): BeachContext {
  return {
    bidn: b.bidn,
    name: b.name,
    location: b.midpoint!,
    region: "puget_sound",
    doh: b,
    razorBeach: null,
    razorDigDates: [],
    ...extra,
  };
}

const maple = context(mapleDoh);
const potlatch = context(potlatchDoh);

describe("tide fit and rating", () => {
  it("is 1 at or below ideal, 0 at or above marginal, linear between", () => {
    expect(tideFit(-1, -0.5, 1.5)).toBe(1);
    expect(tideFit(0.5, -0.5, 1.5)).toBe(0.5);
    expect(tideFit(2, -0.5, 1.5)).toBe(0);
  });

  it("rates scores", () => {
    expect(ratingFor(0.9)).toBe("great");
    expect(ratingFor(0.6)).toBe("good");
    expect(ratingFor(0.3)).toBe("marginal");
    expect(ratingFor(0.1)).toBe("poor");
  });
});

describe("gate", () => {
  it("closes out-of-season beaches with the season as the reason", () => {
    expect(gate("oyster", potlatch, "2026-11-01", "2026-11-01")).toEqual({ legal: false, reason: "WDFW season closed" });
  });

  it("allows a future in-season day at a beach closed today only for the season", () => {
    const g = gate("oyster", potlatch, "2027-04-10", "2026-11-01");
    // 2027 season dates are not published yet, so this is still out of season.
    expect(g.legal).toBe(false);
    const nextYear = context(potlatchDoh, {
      doh: { ...potlatchDoh, clamSeason: { start: "2027-04-01", end: "2027-05-31" }, oysterSeason: null },
    });
    const g2 = gate("oyster", nextYear, "2027-04-10", "2026-11-01");
    expect(g2.legal).toBe(true);
    if (g2.legal) expect(g2.cautions[0]).toMatch(/DOH must reopen/);
  });

  it("opens year-round beaches with DOH advisories as cautions", () => {
    const g = gate("oyster", maple, "2026-11-01", "2026-11-01");
    expect(g).toEqual({ legal: true, cautions: ["Not evaluated by DOH for pollution"] });
  });

  it("honors species-specific DOH closures", () => {
    const closed = context(mapleDoh, { doh: { ...mapleDoh, closedFor: ["butter_clam"] } });
    expect(gate("butter_clam", closed, "2026-11-01", "2026-11-01")).toEqual({ legal: false, reason: "Closed by DOH" });
    expect(gate("manila_clam", closed, "2026-11-01", "2026-11-01").legal).toBe(true);
  });

  it("keeps species out of the wrong region and unmonitored beaches", () => {
    expect(gate("razor_clam", maple, "2026-11-01", "2026-11-01").legal).toBe(false);
    expect(gate("oyster", { ...maple, doh: null }, "2026-11-01", "2026-11-01")).toEqual({
      legal: false,
      reason: "Not monitored by DOH; check the DOH safety map",
    });
  });

  it("opens razor clams only on announced dig days", () => {
    const mocrocks: BeachContext = {
      bidn: "razor-mocrocks",
      name: "Mocrocks",
      location: { lat: 47.1, lng: -124.18 },
      region: "pacific_coast",
      doh: null,
      razorBeach: "Mocrocks",
      razorDigDates: ["2026-10-26", "2026-10-29"],
    };
    expect(gate("razor_clam", mocrocks, "2026-10-26", "2026-10-20").legal).toBe(true);
    expect(gate("razor_clam", mocrocks, "2026-10-27", "2026-10-20").legal).toBe(false);
  });
});

describe("scoreDay", () => {
  it("rates the 2:58 a.m. -0.97 ft low as poor under the default daylight window", () => {
    const s = scoreDay("oyster", maple, "2026-11-01", tides, DEFAULT_PREFS);
    expect(s.best?.low.heightFt).toBe(-0.966);
    expect(s.best?.tideFit).toBe(1);
    expect(s.best?.windowFit).toBe(0);
    expect(s.rating).toBe("poor");
  });

  it("rates the same low as great for a user whose window is midnight to 6 a.m.", () => {
    const s = scoreDay("oyster", maple, "2026-11-01", tides, {
      window: { kind: "custom", startMinutes: 0, endMinutes: 6 * 60 },
    });
    expect(s.rating).toBe("great");
    expect(s.best?.usable?.start.toISOString()).toBe("2026-11-01T08:58:00.000Z");
  });

  it("handles evening windows that wrap past midnight", () => {
    const late: TideEvent[] = [{ time: zonedTime("2026-11-05", 23 * 60), heightFt: -1, type: "L" }];
    // Harvest window 21:00-01:00. A 6pm-2am window covers all of it.
    const wide = scoreDay("oyster", maple, "2026-11-05", late, {
      window: { kind: "custom", startMinutes: 18 * 60, endMinutes: 2 * 60 },
    });
    expect(wide.best?.windowFit).toBe(1);
    expect(wide.rating).toBe("great");
    // A 6pm-midnight window covers 3 of its 4 hours.
    const evening = scoreDay("oyster", maple, "2026-11-05", late, {
      window: { kind: "custom", startMinutes: 18 * 60, endMinutes: 0 },
    });
    expect(evening.best?.windowFit).toBe(0.75);
    expect(evening.rating).toBe("good");
  });

  it("marks closed days as closed regardless of tide", () => {
    expect(scoreDay("oyster", potlatch, "2026-11-01", tides).rating).toBe("closed");
  });
});

describe("search and summaries", () => {
  // A synthetic week: one midday low per day, getting lower through the week.
  const week: TideEvent[] = Array.from({ length: 7 }, (_, i) => ({
    time: zonedTime(`2026-11-0${i + 2}`, 12 * 60),
    heightFt: 2 - i * 0.6,
    type: "L" as const,
  }));

  it("finds the next good oyster day", () => {
    const [next] = nextIdealDays("oyster", maple, week, DEFAULT_PREFS, { fromKey: "2026-11-02", days: 7 });
    // Heights: 2.0, 1.4, 0.8, 0.2, -0.4, ... ; oysters are good from 0.5 ft (fit 0.5) down.
    expect(next.date).toBe("2026-11-05");
    expect(next.rating).toBe("good");
  });

  it("respects the day-of-week filter", () => {
    // 2026-11-07 is a Saturday.
    const [next] = nextIdealDays(
      "oyster",
      maple,
      week,
      { ...DEFAULT_PREFS, daysOfWeek: [0, 6] },
      { fromKey: "2026-11-02", days: 7 },
    );
    expect(next.date).toBe("2026-11-07");
  });

  it("picks the best species for a day and writes the notification", () => {
    const best = bestOfDay(["geoduck", "oyster", "manila_clam"], maple, "2026-11-04", week);
    expect(best?.speciesId).toBe("manila_clam");
    expect(notificationText(best!, "Maple Hollow")).toBe("Today is a great day for Manila clams at Maple Hollow!");
  });
});

describe("fast local time", () => {
  it("matches Intl across a year including DST changes", async () => {
    const { localParts } = await import("../src/time.ts");
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const start = Date.UTC(2026, 0, 1);
    for (let t = start; t < start + 366 * 86400000; t += 7 * 60000 + 13000) {
      const d = new Date(t);
      const want: Record<string, number> = {};
      for (const p of f.formatToParts(d)) if (p.type !== "literal") want[p.type] = Number(p.value);
      const got = localParts(d);
      expect([got.year, got.month, got.day, got.hour, got.minute, got.second]).toEqual([
        want.year, want.month, want.day, want.hour, want.minute, want.second,
      ]);
    }
  });
});
