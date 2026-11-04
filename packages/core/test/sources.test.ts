import { describe, expect, it } from "vitest";
import SunCalc from "suncalc";
import noaaFixture from "./fixtures/noaa-seattle-2026-11-01.json";
import dohFixture from "./fixtures/doh-beaches.json";
import {
  beachPoint,
  dateChunks,
  dohQueryUrl,
  localDateKey,
  localMinutes,
  nearest,
  parseClosedFor,
  parseDohQuery,
  parsePredictions,
  parseStations,
  predictionsUrl,
  sunTimes,
  titleCaseBeach,
  zonedTime,
} from "../src/index.ts";

describe("time", () => {
  it("converts WA wall-clock times across the Nov 1, 2026 DST change", () => {
    // Before the change, PDT (UTC-7); after, PST (UTC-8).
    expect(zonedTime("2026-10-31", 12 * 60).toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(zonedTime("2026-11-01", 12 * 60).toISOString()).toBe("2026-11-01T20:00:00.000Z");
    expect(zonedTime("2026-07-04", 22 * 60).toISOString()).toBe("2026-07-05T05:00:00.000Z");
  });

  it("gives local date and minutes", () => {
    const t = new Date("2026-11-02T01:03:00Z");
    expect(localDateKey(t)).toBe("2026-11-01");
    expect(localMinutes(t)).toBe(17 * 60 + 3);
  });
});

describe("sun", () => {
  const places = [
    { name: "Seattle", lat: 47.6026, lng: -122.3393 },
    { name: "Westport", lat: 46.9043, lng: -124.1051 },
    { name: "Birch Bay", lat: 48.9182, lng: -122.7652 },
  ];
  const dates = ["2026-01-15", "2026-03-08", "2026-06-21", "2026-11-01", "2026-12-21"];

  for (const p of places) {
    for (const d of dates) {
      it(`matches suncalc within a minute at ${p.name} on ${d}`, () => {
        const ours = sunTimes(d, p.lat, p.lng);
        const ref = SunCalc.getTimes(zonedTime(d, 12 * 60), p.lat, p.lng);
        expect(Math.abs(ours.sunrise.getTime() - ref.sunrise.getTime())).toBeLessThan(60000);
        expect(Math.abs(ours.sunset.getTime() - ref.sunset.getTime())).toBeLessThan(60000);
        expect(localDateKey(ours.sunrise)).toBe(d);
      });
    }
  }

  it("puts Seattle sunrise near 7 a.m. PST on Nov 1, 2026", () => {
    const { sunrise, sunset } = sunTimes("2026-11-01", 47.6026, -122.3393);
    expect(localMinutes(sunrise)).toBeGreaterThan(6 * 60 + 45);
    expect(localMinutes(sunrise)).toBeLessThan(7 * 60 + 15);
    expect(localMinutes(sunset)).toBeGreaterThan(16 * 60 + 40);
    expect(localMinutes(sunset)).toBeLessThan(17 * 60 + 5);
  });
});

describe("NOAA", () => {
  it("builds a GMT, MLLW, hilo predictions URL", () => {
    const url = new URL(predictionsUrl("9447130", "2026-11-01", "2026-11-30"));
    expect(url.searchParams.get("begin_date")).toBe("20261101");
    expect(url.searchParams.get("end_date")).toBe("20261130");
    expect(url.searchParams.get("datum")).toBe("MLLW");
    expect(url.searchParams.get("time_zone")).toBe("gmt");
    expect(url.searchParams.get("interval")).toBe("hilo");
  });

  it("parses predictions as UTC instants", () => {
    const events = parsePredictions(noaaFixture);
    expect(events).toHaveLength(8);
    expect(events[0]).toEqual({ time: new Date("2026-11-01T10:58:00Z"), heightFt: -0.966, type: "L" });
    expect(localDateKey(events[0].time)).toBe("2026-11-01");
  });

  it("raises NOAA errors", () => {
    expect(() => parsePredictions({ error: { message: "No Predictions data was found" } })).toThrow(/No Predictions/);
  });

  it("splits long ranges into 31-day chunks", () => {
    const chunks = dateChunks("2026-01-01", "2026-03-15");
    expect(chunks).toEqual([
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-03-03"],
      ["2026-03-04", "2026-03-15"],
    ]);
  });

  it("keeps only Washington stations and finds the nearest", () => {
    const stations = parseStations({
      stations: [
        { id: "9447130", name: "Seattle", lat: 47.6026, lng: -122.3393, state: "WA", type: "R" },
        { id: "9446484", name: "Tacoma", lat: 47.2667, lng: -122.4133, state: "WA", type: "R" },
        { id: "9439040", name: "Astoria", lat: 46.2073, lng: -123.7683, state: "OR", type: "R" },
      ],
    });
    expect(stations.map((s) => s.id)).toEqual(["9447130", "9446484"]);
    const hit = nearest({ lat: 47.299, lng: -122.746 }, stations);
    expect(hit?.item.name).toBe("Tacoma");
  });
});

describe("DOH beaches layer", () => {
  const { beaches, more } = parseDohQuery(dohFixture);
  const [potlatch, maple] = beaches;

  it("queries WGS84 pages of 2000", () => {
    const url = new URL(dohQueryUrl(2000));
    expect(url.searchParams.get("outSR")).toBe("4326");
    expect(url.searchParams.get("resultOffset")).toBe("2000");
  });

  it("parses identity and status", () => {
    expect(more).toBe(false);
    expect(potlatch).toMatchObject({
      bidn: "270440",
      name: "Potlatch SP",
      county: "Mason",
      status: "closed",
      closedFor: "all",
      wdfwOpen: 0,
      seasonText: "Clams, Mussels & Oysters: Open April 1 through May 31, 2026 only.",
      clamSeason: { start: "2026-04-01", end: "2026-05-31" },
    });
    expect(maple).toMatchObject({
      bidn: "280630",
      name: "Maple Hollow",
      status: "unclassified",
      closedFor: [],
      closedForText: "Scallops",
      clamSeason: { start: "2026-01-01", end: "2026-12-31" },
      vibrio: false,
      infoLink: "https://www.keypenparks.com/maple-hollow-park.html",
    });
    expect(beachPoint(maple)).toEqual({ lat: 47.29912437, lng: -122.74612725 });
  });

  it("maps closed-for text to species", () => {
    expect(parseClosedFor("None")).toEqual([]);
    expect(parseClosedFor("Scallops")).toEqual([]);
    expect(parseClosedFor("All Species")).toBe("all");
    expect(parseClosedFor("Butter and Varnish Clams")).toEqual(["butter_clam", "varnish_clam"]);
    const generic = parseClosedFor("Clams, Mussels, Oysters");
    expect(generic).toContain("manila_clam");
    expect(generic).toContain("geoduck");
    expect(generic).not.toContain("razor_clam");
    expect(generic).toContain("oyster");
    expect(generic).toContain("mussel");
  });

  it("title-cases beach names", () => {
    expect(titleCaseBeach("DNR 33")).toBe("DNR 33");
    expect(titleCaseBeach("TWANOH SP")).toBe("Twanoh SP");
  });
});
