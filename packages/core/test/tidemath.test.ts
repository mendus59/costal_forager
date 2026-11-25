import { describe, expect, it } from "vitest";
import { nextHighAndLow, tideCurve, tideDays, tideHeightAt, tideRising, type TideEvent } from "../src/index.ts";

const at = (iso: string) => new Date(iso);
const events: TideEvent[] = [
  { time: at("2026-11-09T00:00:00Z"), heightFt: -1, type: "L" },
  { time: at("2026-11-09T06:00:00Z"), heightFt: 11, type: "H" },
  { time: at("2026-11-09T12:00:00Z"), heightFt: 3, type: "L" },
  { time: at("2026-11-09T18:00:00Z"), heightFt: 9, type: "H" },
];

describe("tide math (ported from TideWidget)", () => {
  it("finds the next high and low strictly after now", () => {
    const n = nextHighAndLow(events, at("2026-11-09T06:00:00Z"));
    expect(n.low?.heightFt).toBe(3);
    expect(n.high?.heightFt).toBe(9);
    expect(nextHighAndLow(events, at("2026-11-09T19:00:00Z"))).toEqual({ high: null, low: null });
  });

  it("interpolates with a half cosine between turns", () => {
    expect(tideHeightAt(events, at("2026-11-09T03:00:00Z"))).toBeCloseTo(5);
    expect(tideHeightAt(events, at("2026-11-09T01:00:00Z"))).toBeCloseTo(-1 + 12 * ((1 - Math.cos(Math.PI / 6)) / 2));
    expect(tideHeightAt(events, at("2026-11-08T23:00:00Z"))).toBeNull();
    expect(tideHeightAt(events, at("2026-11-09T20:00:00Z"))).toBeNull();
  });

  it("knows whether the water is rising", () => {
    expect(tideRising(events, at("2026-11-09T01:00:00Z"))).toBe(true);
    expect(tideRising(events, at("2026-11-09T07:00:00Z"))).toBe(false);
  });

  it("samples a curve, skipping times without predictions", () => {
    const c = tideCurve(events, at("2026-11-08T22:00:00Z"), at("2026-11-09T02:00:00Z"));
    expect(c.map((p) => p.time.toISOString())).toEqual([
      "2026-11-09T00:00:00.000Z",
      "2026-11-09T01:00:00.000Z",
      "2026-11-09T02:00:00.000Z",
    ]);
  });
});

describe("tideDays", () => {
  const ev = (iso: string, ft: number, type: "H" | "L"): TideEvent => ({ time: at(iso), heightFt: ft, type });
  // Pacific Standard Time is UTC-8 in November.
  const list = [
    ev("2026-11-24T20:00:00Z", 10, "H"), // Nov 24 12 PM, before `from`
    ev("2026-11-25T02:00:00Z", -1, "L"), // Nov 24 6 PM
    ev("2026-11-25T09:00:00Z", 11, "H"), // Nov 25 1 AM
    ev("2026-11-25T15:00:00Z", 2, "L"), // Nov 25 7 AM
    ev("2026-11-26T15:00:00Z", 2, "L"), // Nov 26 7 AM, past 2 days
  ];

  it("groups future highs and lows by local day and stops after the last day", () => {
    const days = tideDays(list, at("2026-11-24T22:00:00Z"), 2);
    expect(days.map((d) => d.key)).toEqual(["2026-11-24", "2026-11-25"]);
    expect(days[0].events.map((e) => e.heightFt)).toEqual([-1]);
    expect(days[1].events.map((e) => e.heightFt)).toEqual([11, 2]);
  });

  it("sorts unsorted input", () => {
    const days = tideDays([...list].reverse(), at("2026-11-24T22:00:00Z"), 3);
    expect(days.flatMap((d) => d.events.map((e) => e.heightFt))).toEqual([-1, 11, 2, 2]);
  });
});
