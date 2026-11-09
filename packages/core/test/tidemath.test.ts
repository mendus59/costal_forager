import { describe, expect, it } from "vitest";
import { nextHighAndLow, tideCurve, tideHeightAt, tideRising, type TideEvent } from "../src/index.ts";

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
