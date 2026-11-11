/**
 * Draws a tide chart into pixels, the way TideWidget's home-screen widget
 * does: a smooth tide curve with a soft fill under it, a dashed line at "now",
 * and a dot on each high (red) and low (blue). Android widgets have no canvas,
 * so the app draws the chart here, saves it as a PNG (see png.ts), and the
 * widget shows the image.
 */
import type { TideEvent } from "./noaa.ts";
import { encodePng } from "./png.ts";
import { tideHeightAt, tidePhaseHex } from "./tidemath.ts";

export interface TideChartColors {
  /** The tide curve. */
  line: string;
  /** Fill under the curve (its alpha fades toward the bottom). */
  fill: string;
  /** Fill under the curve where the water is at or below `harvestFt`. */
  harvest: string;
  high: string;
  low: string;
  /** The dashed "now" line; may carry alpha as #rrggbbaa. */
  now: string;
}

/** TideWidget's colors. */
export const TIDE_CHART_COLORS: TideChartColors = {
  line: tidePhaseHex(0),
  fill: tidePhaseHex(0),
  harvest: "#7fd6a0",
  high: tidePhaseHex(1),
  low: tidePhaseHex(0),
  now: "#88888899",
};

export interface TideChartOptions {
  /** Size in pixels. */
  width: number;
  height: number;
  from: Date;
  to: Date;
  /** Where to draw the dashed line; omit for none. */
  now?: Date | null;
  /** Pixels per dp: line widths and dots scale with it. Default 2.5. */
  scale?: number;
  /** Shade the fill in the harvest color where the water is at or below this (feet). */
  harvestFt?: number | null;
  colors?: Partial<TideChartColors>;
}

export interface Pixels {
  width: number;
  height: number;
  /** Straight-alpha RGBA, row-major. */
  rgba: Uint8Array;
}

type RGBA = [number, number, number, number];

function parseColor(c: string): RGBA {
  const h = c.replace("#", "");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length >= 8 ? n(6) / 255 : 1];
}

function blend(px: Uint8Array, i: number, c: RGBA, coverage: number) {
  const a = c[3] * Math.min(1, Math.max(0, coverage));
  if (a <= 0) return;
  const da = px[i + 3] / 255;
  const oa = a + da * (1 - a);
  for (let k = 0; k < 3; k++) px[i + k] = Math.round((c[k] * a + px[i + k] * da * (1 - a)) / oa);
  px[i + 3] = Math.round(oa * 255);
}

/** Distance from (px, py) to the segment (ax, ay)-(bx, by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Draw the chart for `events` (tide highs and lows sorted by time) between
 * `from` and `to`, scaled to the lowest and highest water in that window.
 * Returns null when the predictions don't cover enough of the window.
 */
export function drawTideChart(events: readonly TideEvent[], o: TideChartOptions): Pixels | null {
  const W = Math.max(8, Math.round(o.width));
  const H = Math.max(8, Math.round(o.height));
  const s = o.scale ?? 2.5;
  const col = { ...TIDE_CHART_COLORS, ...o.colors };
  const t0 = o.from.getTime();
  const t1 = o.to.getTime();
  const timeAt = (x: number) => t0 + ((t1 - t0) * x) / W;
  const xAt = (t: number) => (W * (t - t0)) / (t1 - t0);

  // Water height at each column's center (and both edges, so the line reaches them).
  const xs: number[] = [0];
  for (let x = 0; x < W; x++) xs.push(x + 0.5);
  xs.push(W);
  const hs = xs.map((x) => tideHeightAt(events, new Date(timeAt(x))));
  const known = hs.filter((h): h is number => h !== null);
  if (known.length < W / 4) return null;
  const lo = Math.min(...known);
  const hi = Math.max(Math.max(...known), lo + 0.1);
  const lineW = 2.2 * s;
  const dotR = 3.2 * s;
  const padY = Math.max(6 * s, dotR + lineW);
  const yAt = (h: number) => padY + (H - 2 * padY) * (1 - (h - lo) / (hi - lo));
  const ys = hs.map((h) => (h === null ? null : yAt(h)));

  const px = new Uint8Array(W * H * 4);

  // Fill under the curve, fading from 40% at the top of the chart to 3% at the bottom.
  const fill = parseColor(col.fill);
  const harvest = parseColor(col.harvest);
  for (let x = 0; x < W; x++) {
    const yc = ys[x + 1];
    const h = hs[x + 1];
    if (yc === null || h === null) continue;
    const low = o.harvestFt != null && h <= o.harvestFt;
    const c = low ? harvest : fill;
    for (let y = Math.max(0, Math.floor(yc)); y < H; y++) {
      // The harvest shade stays visible at the bottom, where low water sits.
      const alpha = low ? 0.35 : 0.4 - (0.37 * y) / H;
      blend(px, (y * W + x) * 4, [c[0], c[1], c[2], alpha * c[3]], y + 1 - yc);
    }
  }

  // The curve: anti-aliased by each pixel's distance to the nearby segments.
  const line = parseColor(col.line);
  const r = lineW / 2;
  const reach = Math.ceil(r + 1);
  for (let x = 0; x < W; x++) {
    let yMin = Infinity;
    let yMax = -Infinity;
    const segs: [number, number, number, number][] = [];
    for (let k = Math.max(0, x - reach); k <= Math.min(xs.length - 2, x + reach + 1); k++) {
      const a = ys[k];
      const b = ys[k + 1];
      if (a === null || b === null) continue;
      segs.push([xs[k], a, xs[k + 1], b]);
      yMin = Math.min(yMin, a, b);
      yMax = Math.max(yMax, a, b);
    }
    if (segs.length === 0) continue;
    for (let y = Math.max(0, Math.floor(yMin - r - 1)); y <= Math.min(H - 1, Math.ceil(yMax + r + 1)); y++) {
      let d = Infinity;
      for (const [ax, ay, bx, by] of segs) d = Math.min(d, segDist(x + 0.5, y + 0.5, ax, ay, bx, by));
      blend(px, (y * W + x) * 4, line, r + 0.5 - d);
    }
  }

  // Dashed "now" line.
  if (o.now) {
    const nx = xAt(o.now.getTime());
    if (nx >= 0 && nx <= W) {
      const now = parseColor(col.now);
      const half = (1.2 * s) / 2;
      const dash = 4 * s;
      const gap = 3 * s;
      for (let y = 0; y < H; y++) {
        if ((y + 0.5) % (dash + gap) >= dash) continue;
        for (let x = Math.max(0, Math.floor(nx - half - 1)); x <= Math.min(W - 1, Math.ceil(nx + half + 1)); x++) {
          blend(px, (y * W + x) * 4, now, half + 0.5 - Math.abs(x + 0.5 - nx));
        }
      }
    }
  }

  // A dot on each high and low in the window.
  const high = parseColor(col.high);
  const low = parseColor(col.low);
  for (const e of events) {
    const t = e.time.getTime();
    if (t < t0 || t > t1) continue;
    const cx = xAt(t);
    const cy = yAt(e.heightFt);
    const c = e.type === "H" ? high : low;
    for (let y = Math.max(0, Math.floor(cy - dotR - 1)); y <= Math.min(H - 1, Math.ceil(cy + dotR + 1)); y++) {
      for (let x = Math.max(0, Math.floor(cx - dotR - 1)); x <= Math.min(W - 1, Math.ceil(cx + dotR + 1)); x++) {
        blend(px, (y * W + x) * 4, c, dotR + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
      }
    }
  }

  return { width: W, height: H, rgba: px };
}

/** drawTideChart as a PNG file's bytes, or null without enough predictions. */
export function tideChartPng(events: readonly TideEvent[], o: TideChartOptions): Uint8Array | null {
  const p = drawTideChart(events, o);
  return p ? encodePng(p.width, p.height, p.rgba) : null;
}
