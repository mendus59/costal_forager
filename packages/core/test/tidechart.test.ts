import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { drawTideChart, encodePng, parsePredictions, tideChartPng, tidePhase, tidePhaseHex, toBase64 } from "../src/index.ts";

const events = parsePredictions(JSON.parse(readFileSync(new URL("./fixtures/noaa-seattle-2026-11-01.json", import.meta.url), "utf8")));
const now = new Date(events[1].time.getTime() + 2 * 3600e3);
const opts = {
  width: 300,
  height: 80,
  from: new Date(now.getTime() - 3 * 3600e3),
  to: new Date(now.getTime() + 21 * 3600e3),
  now,
};

describe("PNG encoder", () => {
  it("writes a valid PNG whose data inflates back to the filtered rows", () => {
    const rgba = new Uint8Array(5 * 3 * 4).map((_, i) => (i * 37) % 256);
    const png = encodePng(5, 3, rgba);
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const idatAt = Buffer.from(png).indexOf("IDAT");
    const len = Buffer.from(png).readUInt32BE(idatAt - 4);
    const raw = inflateSync(png.slice(idatAt + 4, idatAt + 4 + len));
    expect(raw.length).toBe((5 * 4 + 1) * 3);
    // Undo the Sub filter and compare.
    for (let y = 0; y < 3; y++) {
      const row = raw.subarray(y * 21 + 1, y * 21 + 21);
      const out = new Uint8Array(20);
      for (let x = 0; x < 20; x++) out[x] = (row[x] + (x >= 4 ? out[x - 4] : 0)) & 0xff;
      expect([...out]).toEqual([...rgba.subarray(y * 20, y * 20 + 20)]);
    }
  });

  it("base64-encodes like Buffer", () => {
    for (const n of [0, 1, 2, 3, 10]) {
      const b = new Uint8Array(n).map((_, i) => i * 51);
      expect(toBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});

describe("tide chart", () => {
  it("draws the curve, the high and low dots and the now line", () => {
    const p = drawTideChart(events, opts)!;
    const at = (x: number, y: number) => [...p.rgba.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
    // The first high is in the window: a red dot near the top.
    const hx = Math.round((300 * (events[1].time.getTime() - opts.from.getTime())) / (24 * 3600e3));
    const top = Array.from({ length: 80 }, (_, y) => at(hx, y)).find((c) => c[3] === 255)!;
    expect(top[0]).toBeGreaterThan(200);
    // Some pixel in the now column is the dashed gray line.
    const nx = Math.round(300 * (3 / 24));
    expect(Array.from({ length: 10 }, (_, y) => at(nx, y)).some((c) => c[3] > 100 && Math.abs(c[0] - c[2]) < 20)).toBe(true);
    // Above the curve stays transparent.
    expect(at(150, 0)[3]).toBe(0);
  });

  it("returns null without predictions for the window", () => {
    expect(drawTideChart([], opts)).toBeNull();
    expect(tideChartPng(events.slice(0, 1), opts)).toBeNull();
  });

  it("compresses a chart to a small file", () => {
    expect(tideChartPng(events, { ...opts, width: 600, height: 160 })!.length).toBeLessThan(40000);
  });
});

describe("tide phase colors (from TideWidget)", () => {
  it("runs from blue at low tide to red at high tide", () => {
    expect(tidePhaseHex(0)).toBe("#2159cc");
    expect(tidePhaseHex(1)).toBe("#e03833");
    expect(tidePhase(events, new Date(events[0].time.getTime() + 60000))).toBeLessThan(0.01);
    expect(tidePhase(events, new Date(events[1].time.getTime() - 60000))).toBeGreaterThan(0.99);
  });
});
