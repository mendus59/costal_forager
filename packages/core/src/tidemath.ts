/**
 * Tide curve math, ported from Patrick's TideWidget project
 * (github.com/mendus59/TideWidget, tidecore/TideMath.kt and web/js/tidemath.js)
 * so the CostalForager widget draws tides the same way.
 *
 * NOAA "hilo" predictions only give the highs and lows; the water level in
 * between is a half cosine from one to the next.
 */
import type { TideEvent } from "./noaa.ts";

/** The next high and next low strictly after `at`. */
export function nextHighAndLow(events: readonly TideEvent[], at: Date): { high: TideEvent | null; low: TideEvent | null } {
  const t = at.getTime();
  let high: TideEvent | null = null;
  let low: TideEvent | null = null;
  for (const e of events) {
    if (e.time.getTime() <= t) continue;
    if (e.type === "H" && !high) high = e;
    if (e.type === "L" && !low) low = e;
    if (high && low) break;
  }
  return { high, low };
}

function bracket(events: readonly TideEvent[], t: number) {
  const i = events.findIndex((e) => e.time.getTime() > t);
  if (i <= 0) return null;
  const a = events[i - 1];
  const b = events[i];
  return { a, b, f: (t - a.time.getTime()) / (b.time.getTime() - a.time.getTime()) };
}

const ease = (f: number) => (1 - Math.cos(Math.PI * f)) / 2;

/** Water height in feet (MLLW) at `at`, or null outside the predictions. Events must be sorted by time. */
export function tideHeightAt(events: readonly TideEvent[], at: Date): number | null {
  const br = bracket(events, at.getTime());
  return br ? br.a.heightFt + (br.b.heightFt - br.a.heightFt) * ease(br.f) : null;
}

/** True while the water is coming in, null outside the predictions. */
export function tideRising(events: readonly TideEvent[], at: Date): boolean | null {
  const br = bracket(events, at.getTime());
  return br ? br.b.type === "H" : null;
}

export interface TideCurvePoint {
  time: Date;
  heightFt: number;
}

/**
 * Water heights every `stepMinutes` from `from` to `to` (inclusive), skipping
 * times outside the predictions. TideWidget draws 3 hours back through 21 ahead.
 */
export function tideCurve(events: readonly TideEvent[], from: Date, to: Date, stepMinutes = 60): TideCurvePoint[] {
  const out: TideCurvePoint[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += stepMinutes * 60000) {
    const h = tideHeightAt(events, new Date(t));
    if (h !== null) out.push({ time: new Date(t), heightFt: h });
  }
  return out;
}

/**
 * 0 at low tide and 1 at high tide, relative to the tides on either side, so
 * places with very different ranges compare fairly. TideWidget colors its map
 * with this. Null outside the predictions.
 */
export function tidePhase(events: readonly TideEvent[], at: Date): number | null {
  const br = bracket(events, at.getTime());
  if (!br) return null;
  return br.a.type === "L" ? ease(br.f) : 1 - ease(br.f);
}

const PHASE_STOPS: [number, [number, number, number]][] = [
  [0.0, [33, 89, 204]],
  [0.35, [26, 179, 191]],
  [0.65, [250, 204, 64]],
  [1.0, [224, 56, 51]],
];

/** TideWidget's tide colors: blue at low tide, through teal and yellow, to red at high tide. */
export function tidePhaseRgb(phase: number): [number, number, number] {
  const p = Math.min(1, Math.max(0, phase));
  let j = PHASE_STOPS.findIndex((s) => s[0] >= p);
  if (j < 1) j = 1;
  const [p0, c0] = PHASE_STOPS[j - 1];
  const [p1, c1] = PHASE_STOPS[j];
  const f = (p - p0) / (p1 - p0);
  return [0, 1, 2].map((k) => Math.trunc(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number];
}

/** "#2159cc" for a tide phase. */
export function tidePhaseHex(phase: number): string {
  return "#" + tidePhaseRgb(phase).map((c) => c.toString(16).padStart(2, "0")).join("");
}
