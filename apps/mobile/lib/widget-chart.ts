/**
 * Draws the Android widget's tide chart into PNG files. Glance has no canvas,
 * so (like TideWidget, which draws a bitmap) the chart is an image: the app
 * draws it with the shared chart code, saves it in the widgets directory, and
 * the widget layout shows the file whose shape best fits the widget.
 *
 * The widget can be resized, and its layout learns its size only when it
 * renders, so a patch (scripts/patch-expo-widgets.cjs) records the sizes it
 * rendered at and, when it sees a new one, runs the widget's background task
 * so the chart is redrawn for it. The chart is drawn for those sizes plus a
 * few common shapes.
 */
import { tideChartPng, type TideEvent } from '@costal-forager/core';
import { Directory, File, Paths } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { PixelRatio } from 'react-native';

import { CHART_SHAPES, WIDGET_COLORS, widgetGeometry, type TideChartImage } from '@/widgets/types';
import { chartWindow } from './widget-data';

/**
 * The widget's recent sizes in dp, newest first, written by the expo-widgets
 * patch (one "width,height" per line; a launcher has one size for portrait
 * and one for landscape). Empty before the widget first renders.
 */
export function recentWidgetSizes(name: string): { w: number; h: number }[] {
  try {
    const f = new File(Paths.document, `widget-size-${name}.txt`);
    if (!f.exists) return [];
    return f
      .textSync()
      .split('\n')
      .map((line) => line.split(',').map(Number))
      .filter(([w, h]) => w > 0 && h > 0)
      .map(([w, h]) => ({ w, h }));
  } catch {
    return [];
  }
}

/**
 * Draw the chart at `at` for the widget's recent sizes and the common ratios,
 * save them, and remove charts from earlier updates.
 */
export function writeWidgetCharts(name: string, tides: TideEvent[], at: Date, harvestFt: number | null, hasSub: boolean): TideChartImage[] {
  const dir = new Directory(widgetsDirectory);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const density = Math.min(3, PixelRatio.get());

  // [width, height] in dp: the real chart boxes when known, then the common shapes.
  const boxes: [number, number][] = [];
  for (const size of recentWidgetSizes(name)) {
    const g = widgetGeometry(size.w, size.h, hasSub, PixelRatio.getFontScale());
    if (g.chartH > 0 && !boxes.some(([bw, bh]) => bw === g.chartW && bh === g.chartH)) boxes.push([g.chartW, g.chartH]);
  }
  for (const [a, h] of CHART_SHAPES) {
    if (!boxes.some(([bw, bh]) => Math.abs(Math.log(bw / bh / a)) < 0.05)) boxes.push([Math.round(h * a), h]);
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
      // No line here: the widget layout draws "now" from the time it renders.
      now: null,
      // Thinner lines and dots on the small 3x1 chart.
      scale: density * (h < 70 ? 0.8 : 1),
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
