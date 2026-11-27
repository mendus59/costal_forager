/**
 * Android home-screen widget (Glance via expo-widgets). Like TideWidget it
 * fits itself to its size, from 1x1 up: the first rows show the next high and
 * low (more detail as it widens: compact times, then High and Low, then the
 * beach, species and heights). A widget 3 or more columns wide and under
 * 150 dp tall puts a tide chart beside the times; taller ones (and 2-column
 * ones from 2 rows) put the chart under the times: a smooth curve with a dot
 * on each high and low and a dashed line at now, labeled with the water
 * height now ("+4.2 ft ↑"). Beside the times the label sits on the chart's
 * top edge; under them it gets its own row so it never covers the curve.
 * Large widgets get slightly bigger text, and the header's height allows for
 * the phone's text size setting (`fontScale`) so nothing is pushed off the
 * top. The day's rating is a small colored dot.
 *
 * Tapping the top-right corner (↻, from 2 columns wide) refreshes the widget:
 * it redraws at once, so the now line moves to the current time, and the app
 * fetches fresh tides in the background and publishes a new chart (the
 * "refresh" target, handled by scripts/patch-expo-widgets.cjs). Tapping
 * anywhere else opens the app.
 *
 * "Now" comes from the time the widget renders (`nowMs` in the environment),
 * not from when the app last updated it: the chart image has no now line, so
 * the layout draws one over it, and it picks the next high and low from
 * `upcoming`. Android redraws the widget every 30 minutes (the patch sets
 * updatePeriodMillis), which keeps both current without the app running.
 *
 * The layout is serialized, so it may only use its props, its environment
 * and the Jetpack Compose components below: no hooks, no app imports, no
 * module-level values. The size and time come from the environment (added by
 * scripts/patch-expo-widgets.cjs). Glance has no canvas, so the chart is an
 * image the app draws (lib/widget-chart.ts); the layout picks the one whose
 * shape fits best. expo-widgets ignores `weight` on Android, so sizes are
 * computed here; the math matches widgetGeometry in ./types.
 */
import { Box, Button, Column, Image, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, padding, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps, env: unknown) => {
  'widget';
  const e = (env ?? {}) as { widthDp?: number; heightDp?: number; nowMs?: number; fontScale?: number };
  const w = e.widthDp && e.widthDp > 0 ? e.widthDp : 250;
  const h = e.heightDp && e.heightDp > 0 ? e.heightDp : 150;
  const sub = [p.species, p.note].filter((s) => !!s).join(' · ');
  const now = e.nowMs && e.nowMs > 0 ? e.nowMs : 0;
  // The phone's text size setting: text sizes are in sp, so the header grows with it.
  const fontScale = e.fontScale && e.fontScale > 0 ? e.fontScale : 1;

  // The next high and low as of now; the published text if the time or the list is missing.
  const upcoming = p.upcoming ?? [];
  const live = now > 0 && upcoming.length > 0;
  let nextHigh = null as (typeof upcoming)[number] | null;
  let nextLow = null as (typeof upcoming)[number] | null;
  for (const t of upcoming) {
    if (t.t <= now) continue;
    if (t.high && !nextHigh) nextHigh = t;
    if (!t.high && !nextLow) nextLow = t;
  }
  const highTime = !live ? p.highTime : nextHigh ? (now >= nextHigh.dayStart ? nextHigh.time : nextHigh.dayTime) : '--';
  const lowTime = !live ? p.lowTime : nextLow ? (now >= nextLow.dayStart ? nextLow.time : nextLow.dayTime) : '--';
  const highShort = !live ? p.highShort : nextHigh ? (now >= nextHigh.dayStart ? nextHigh.short : nextHigh.dayShort) : '--';
  const lowShort = !live ? p.lowShort : nextLow ? (now >= nextLow.dayStart ? nextLow.short : nextLow.dayShort) : '--';
  const highFt = !live ? p.highFt : nextHigh ? nextHigh.ft : '';
  const lowFt = !live ? p.lowFt : nextLow ? nextLow.ft : '';

  // The water height now: a half cosine between the turns either side of now
  // (the same curve as tideHeightAt in core), else the published text.
  let nowFt = p.nowFt ?? '';
  if (live) {
    nowFt = '';
    let i = 0;
    while (i < upcoming.length && upcoming[i].t <= now) i++;
    if (i > 0 && i < upcoming.length) {
      const a = upcoming[i - 1];
      const b = upcoming[i];
      if (typeof a.h === 'number' && typeof b.h === 'number') {
        const f = (now - a.t) / (b.t - a.t);
        const ft = a.h + ((b.h - a.h) * (1 - Math.cos(Math.PI * f))) / 2;
        nowFt = `${ft > 0 ? '+' : ''}${ft.toFixed(1)} ft ${b.high ? '↑' : '↓'}`;
      }
    }
  }

  // Same math as widgetGeometry() in ./types (INLINE_TEXT_W is 148).
  const cols = w >= 180 ? 3 : w >= 110 ? 2 : 1;
  const rows = h >= (cols === 3 ? 150 : 100) ? 2 : 1;
  const inline = cols === 3 && rows === 1;
  const s = w >= 250 && h >= 200 ? 1.2 : 1;
  const fs = (n: number) => Math.round(n * s);
  const pad = inline ? 8 : cols === 1 || rows === 1 ? 6 : 10;
  let chartW = 0;
  let chartH = 0;
  let labelH = 0;
  if (inline) {
    chartW = Math.floor(w - 2 * (pad + 2) - 148 - 6);
    chartH = Math.min(Math.floor(h - 2 * pad), Math.floor(chartW * 0.8));
    if (chartW < 40 || chartH < 24) chartW = chartH = 0;
  } else if (rows === 2) {
    const header = Math.round((cols === 3 ? 60 + (sub ? 16 : 0) : cols === 2 ? 52 : 48) * s * fontScale) + 6;
    labelH = Math.round(16 * fontScale);
    chartW = Math.floor(w - 2 * (pad + 2));
    chartH = Math.min(Math.floor(h - 2 * pad - header - labelH), Math.floor(chartW * 0.6));
    if (chartH < 24) chartH = labelH = 0;
  }
  // The drawn chart closest in shape, scaled to fit (never stretched).
  const ratio = chartH > 0 ? chartW / chartH : 0;
  let chart = '';
  let chartA = 0;
  let miss = Infinity;
  for (const c of p.charts) {
    const d = Math.abs(Math.log(c.a / ratio));
    if (d < miss) {
      miss = d;
      chart = c.uri;
      chartA = c.a;
    }
  }
  const hasTides = !!(p.highTime || p.lowTime);
  const highColor = '#e03833'; // WIDGET_COLORS.high
  const lowColor = '#5b8ef0'; // WIDGET_COLORS.lowText

  const label = (arrow: string, color: string, text: string) => (
    <Row>
      <Text color={color} maxLines={1} style={{ fontSize: fs(10) }}>
        {`${arrow} `}
      </Text>
      <Text color={p.muted} maxLines={1} style={{ fontSize: fs(10) }}>
        {text}
      </Text>
    </Row>
  );

  // The refresh button in the top-right corner. Its target is what the patch
  // listens for; the layout has no press handler of its own.
  const refreshing = !!p.refreshingAt && now > 0 && now - p.refreshingAt < 60000;
  const refresh =
    cols > 1 ? (
      <Button {...({ target: 'refresh' } as object)} modifiers={[size(28, 28)]}>
        <Box contentAlignment="center" modifiers={[size(28, 28)]}>
          <Box contentAlignment="center" modifiers={[size(20, 20), background(p.bg), cornerRadius(10)]}>
            <Text color={refreshing ? p.muted : p.fg} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
              {refreshing ? '…' : '↻'}
            </Text>
          </Box>
        </Box>
      </Button>
    ) : null;
  const dot = p.status ? (
    <Box modifiers={[padding(0, refresh ? 0 : pad, refresh ? 2 : pad, 0)]}>
      <Box modifiers={[size(10, 10), background(p.dot), cornerRadius(5)]} />
    </Box>
  ) : null;
  const corner = refresh ? (
    <Row verticalAlignment="center" modifiers={[padding(0, Math.max(0, pad - 6), Math.max(0, pad - 4), 0)]}>
      {dot}
      {refresh}
    </Row>
  ) : (
    dot
  );
  // Where the image lands when scaled to fit the chart box, and the dashed line at now over it.
  const imgW = chartA > ratio ? chartW : chartH * chartA;
  const imgH = chartA > ratio ? chartW / chartA : chartH;
  const span = p.chartTo - p.chartFrom;
  const f = now > 0 && span > 0 ? (now - p.chartFrom) / span : -1;
  const lineX = Math.round(((chartW - imgW) / 2 + f * imgW - 0.75) * 10) / 10;
  const dashes = f >= 0 && f <= 1 ? Math.floor((imgH + 3) / 7) : 0;
  const nowLine =
    dashes > 0 ? (
      <Column modifiers={[padding(Math.max(0, lineX), Math.round((chartH - imgH) / 2), 0, 0)]}>
        {/* Glance allows at most 10 children in a Column, so the dashes go in groups of 10. */}
        {Array.from({ length: Math.ceil(dashes / 10) }, (_, g) => (
          <Column key={g}>
            {Array.from({ length: Math.min(10, dashes - g * 10) }, (_, i) => (
              <Box key={i} modifiers={[padding(0, 0, 0, 3)]}>
                <Box modifiers={[size(1.5, 4), background('#b8c9cf')]} />
              </Box>
            ))}
          </Column>
        ))}
      </Column>
    ) : null;
  // The height now, in a small tag just right of the now line: on the chart's
  // top edge in a 1-row strip, in its own row above the chart when taller so
  // it never covers the curve.
  const labelX = Math.round(Math.max(0, lineX) + 4);
  const nowLabel =
    dashes > 0 && nowFt ? (
      <Column modifiers={[padding(labelX, labelH > 0 ? 0 : Math.max(0, Math.round((chartH - imgH) / 2)), 0, 0)]}>
        <Box modifiers={[background(p.bg), cornerRadius(4), padding(3, 0, 3, 0)]}>
          <Text color={p.fg} maxLines={1} style={{ fontSize: 10, fontWeight: 'bold' }}>
            {nowFt}
          </Text>
        </Box>
      </Column>
    ) : null;
  const chartBox =
    hasTides && chart && chartH > 0 ? (
      <Box modifiers={[size(chartW, chartH)]}>
        <Image
          source={{ uri: chart }}
          contentScale="fit"
          contentDescription="Tide chart, next 24 hours"
          modifiers={[size(chartW, chartH)]}
        />
        {nowLine}
        {labelH > 0 ? null : nowLabel}
      </Box>
    ) : null;
  const chartImage =
    chartBox && labelH > 0 ? (
      <Column>
        <Box contentAlignment="bottomStart" modifiers={[size(chartW, labelH)]}>
          {nowLabel}
        </Box>
        {chartBox}
      </Column>
    ) : (
      chartBox
    );

  if (inline && hasTides) {
    // 3x1: beach and times on the left, the chart on the right.
    const line = (arrow: string, color: string, time: string, ft: string) => (
      <Row>
        <Text color={color} maxLines={1} style={{ fontSize: 11 }}>
          {`${arrow} `}
        </Text>
        <Text color={p.fg} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold' }}>
          {`${time} `}
        </Text>
        <Text color={p.muted} maxLines={1} style={{ fontSize: 10 }}>
          {ft}
        </Text>
      </Row>
    );
    return (
      <Box contentAlignment="topEnd" modifiers={[fillMaxSize(), background(p.bg), cornerRadius(16)]}>
        <Row verticalAlignment="center" modifiers={[fillMaxSize(), padding(pad + 2, pad, pad + 2, pad)]}>
          <Column modifiers={[width(148), padding(0, 0, 6, 0)]}>
            <Row verticalAlignment="center">
              {p.status ? (
                <Box modifiers={[padding(0, 0, 5, 0)]}>
                  <Box modifiers={[size(8, 8), background(p.dot), cornerRadius(4)]} />
                </Box>
              ) : null}
              <Text color={p.fg} maxLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>
                {p.beach}
              </Text>
            </Row>
            {p.species && h >= 84 ? (
              <Text color={p.muted} maxLines={1} style={{ fontSize: 10 }}>
                {p.species}
              </Text>
            ) : null}
            {line('▲', highColor, highTime, highFt)}
            {line('▼', lowColor, lowTime, lowFt)}
          </Column>
          {chartImage}
        </Row>
        {refresh ? <Box modifiers={[padding(0, Math.max(0, pad - 6), Math.max(0, pad - 4), 0)]}>{refresh}</Box> : null}
      </Box>
    );
  }

  return (
    <Box contentAlignment="topEnd" modifiers={[fillMaxSize(), background(p.bg), cornerRadius(16)]}>
      <Column modifiers={[fillMaxSize(), padding(pad + 2, pad, pad + 2, pad)]}>
        {cols === 3 || rows === 2 || !hasTides ? (
          <Text
            color={cols === 3 ? p.fg : p.muted}
            maxLines={1}
            style={{ fontSize: fs(cols === 3 ? 14 : cols === 2 ? 11 : 10), fontWeight: cols === 3 ? 'bold' : 'normal' }}>
            {p.beach}
          </Text>
        ) : null}
        {(cols === 3 && sub) || !hasTides ? (
          <Text color={p.muted} maxLines={cols === 3 ? 1 : 3} style={{ fontSize: fs(11) }}>
            {sub}
          </Text>
        ) : null}
        {hasTides && cols === 1 ? (
          <Column>
            <Row>
              <Text color={highColor} maxLines={1} style={{ fontSize: 12 }}>
                {'▲ '}
              </Text>
              <Text color={p.fg} maxLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>
                {highShort}
              </Text>
            </Row>
            <Row>
              <Text color={lowColor} maxLines={1} style={{ fontSize: 12 }}>
                {'▼ '}
              </Text>
              <Text color={p.fg} maxLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>
                {lowShort}
              </Text>
            </Row>
          </Column>
        ) : null}
        {hasTides && cols > 1 ? (
          <Row modifiers={[padding(0, cols === 3 ? 4 : 2, 0, 4)]}>
            <Column modifiers={[padding(0, 0, fs(cols === 3 ? 18 : 10), 0)]}>
              {label('▲', highColor, cols === 3 ? `High  ${highFt}` : 'High')}
              <Text color={p.fg} maxLines={1} style={{ fontSize: fs(15), fontWeight: 'bold' }}>
                {highTime}
              </Text>
            </Column>
            <Column>
              {label('▼', lowColor, cols === 3 ? `Low  ${lowFt}` : 'Low')}
              <Text color={p.fg} maxLines={1} style={{ fontSize: fs(15), fontWeight: 'bold' }}>
                {lowTime}
              </Text>
            </Column>
          </Row>
        ) : null}
        {chartImage}
      </Column>
      {corner}
    </Box>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
