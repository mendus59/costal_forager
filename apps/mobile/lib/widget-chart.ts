/**
 * Draws the Android widget's tide chart into PNG files. Glance has no canvas,
 * so (like TideWidget, which draws a bitmap) the chart is an image: the app
 * draws it with the shared chart code, saves it in the widgets directory, and
 * the widget layout shows the file whose shape best fits the widget.
 *
 * The widget can be resized, and its layout learns its size only when it
 * renders, so a patch (scripts/patch-expo-widgets.cjs) records the last size
 * it rendered at. The chart is drawn for that size plus a few common shapes.
 */
import { tideChartPng, type TideEvent } from '@costal-forager/core';
import { Directory, File, Paths } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { PixelRatio } from 'react-native';

import { CHART_RATIOS, WIDGET_COLORS, widgetGeometry, type TideChartImage } from '@/widgets/types';
import { chartWindow } from './widget-data';

/** The widget's last rendered size in dp, written by the expo-widgets patch, or null before it first renders. */
export function lastWidgetSize(name: string): { w: number; h: number } | null {
  try {
    const f = new File(Paths.document, `widget-size-${name}.txt`);
    if (!f.exists) return null;
    const [w, h] = f.textSync().split(',').map(Number);
    return w > 0 && h > 0 ? { w, h } : null;
  } catch {
    return null;
  }
}

/**
 * Draw the chart at `at` for the widget's last size and the common ratios,
 * save them, and remove charts from earlier updates.
 */
export function writeWidgetCharts(name: string, tides: TideEvent[], at: Date, harvestFt: number, hasSub: boolean): TideChartImage[] {
  const dir = new Directory(widgetsDirectory);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const density = Math.min(3, PixelRatio.get());
  const size = lastWidgetSize(name);
  const g = size ? widgetGeometry(size.w, size.h, hasSub) : null;

  // [width, height] in dp: the real chart box when known, then the fallbacks at a typical 56dp tall.
  const boxes: [number, number][] = [];
  if (g && g.chartH > 0) boxes.push([g.chartW, g.chartH]);
  for (const a of CHART_RATIOS) {
    if (!boxes.some(([w, h]) => Math.abs(Math.log(w / h / a)) < 0.1)) boxes.push([56 * a, 56]);
  }

  const stamp = at.getTime();
  const { from, to } = chartWindow(at);
  const out: TideChartImage[] = [];
  for (const [w, h] of boxes) {
    const png = tideChartPng(tides, {
      width: w * density,
      height: h * density,
      from,
      to,
      now: at,
      scale: density,
      harvestFt,
      colors: { harvest: WIDGET_COLORS.harvest },
    });
    if (!png) continue;
    const a = Math.round((w / h) * 100) / 100;
    const file = new File(dir, `${name}-chart-${stamp}-${out.length}.png`);
    file.write(png);
    out.push({ a, uri: file.uri });
  }

  // Keep this update's charts and the previous one's (the widget may still be showing it).
  const prefix = `${name}-chart-`;
  const stamps = [
    ...new Set(
      dir
        .list()
        .filter((e): e is File => e instanceof File && e.name.startsWith(prefix))
        .map((f) => Number(f.name.slice(prefix.length).split('-')[0])),
    ),
  ].sort((x, y) => y - x);
  const keep = new Set([stamp, ...stamps.filter((s) => s !== stamp).slice(0, 1)]);
  for (const e of dir.list()) {
    if (e instanceof File && e.name.startsWith(prefix) && !keep.has(Number(e.name.slice(prefix.length).split('-')[0]))) {
      try {
        e.delete();
      } catch {}
    }
  }
  return out;
}
