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
