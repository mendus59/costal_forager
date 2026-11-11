/**
 * Android home-screen widget (Glance via expo-widgets). Like TideWidget it
 * fits itself to its size, from 1x1 up: the first rows show the next high and
 * low (more detail as it widens: compact times, then High and Low, then the
 * beach, species and heights), and once it is 2 rows tall a tide chart fills
 * the rest: a smooth curve with a dot on each high and low and a dashed line
 * at now. The day's rating is a small colored dot in the top-right corner.
 *
 * The layout is serialized, so it may only use its props, its environment
 * and the Jetpack Compose components below: no hooks, no app imports, no
 * module-level values. The size comes from the environment (added by
 * scripts/patch-expo-widgets.cjs). Glance has no canvas, so the chart is an
 * image the app draws (lib/widget-chart.ts); the layout picks the one whose
 * shape fits best. expo-widgets ignores `weight` on Android, so sizes are
 * computed here; the math matches widgetGeometry in ./types.
 */
import { Box, Column, Image, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, padding, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps, env: unknown) => {
  'widget';
  const e = (env ?? {}) as { widthDp?: number; heightDp?: number };
  const w = e.widthDp && e.widthDp > 0 ? e.widthDp : 250;
  const h = e.heightDp && e.heightDp > 0 ? e.heightDp : 150;
  const sub = [p.species, p.note].filter((s) => !!s).join(' · ');

  // Same math as widgetGeometry() in ./types.
  const cols = w >= 180 ? 3 : w >= 110 ? 2 : 1;
  const rows = h >= 100 ? 2 : 1;
  const pad = cols === 1 || rows === 1 ? 6 : 10;
  const header = cols === 3 ? 56 + (sub ? 14 : 0) : cols === 2 ? 50 : 46;
  const chartW = Math.floor(w - 2 * (pad + 2));
  const chartH = rows === 2 ? Math.floor(h - 2 * pad - header - 4) : 0;
  const ratio = chartH > 0 ? chartW / chartH : 0;
  let chart = '';
  let miss = Infinity;
  for (const c of p.charts) {
    const d = Math.abs(Math.log(c.a / ratio));
    if (d < miss) {
      miss = d;
      chart = c.uri;
    }
  }
  const hasTides = !!(p.highTime || p.lowTime);
  const highColor = '#e03833'; // WIDGET_COLORS.high
  const lowColor = '#5b8ef0'; // WIDGET_COLORS.lowText

  const label = (arrow: string, color: string, text: string) => (
    <Row>
      <Text color={color} maxLines={1} style={{ fontSize: 10 }}>
        {`${arrow} `}
      </Text>
      <Text color={p.muted} maxLines={1} style={{ fontSize: 10 }}>
        {text}
      </Text>
    </Row>
  );

  return (
    <Box contentAlignment="topEnd" modifiers={[fillMaxSize(), background(p.bg), cornerRadius(16)]}>
      <Column modifiers={[fillMaxSize(), padding(pad + 2, pad, pad + 2, pad)]}>
        {cols === 3 || rows === 2 || !hasTides ? (
          <Text
            color={cols === 3 ? p.fg : p.muted}
            maxLines={1}
            style={{ fontSize: cols === 3 ? 14 : cols === 2 ? 11 : 10, fontWeight: cols === 3 ? 'bold' : 'normal' }}>
            {p.beach}
          </Text>
        ) : null}
        {(cols === 3 && sub) || !hasTides ? (
          <Text color={p.muted} maxLines={cols === 3 ? 1 : 3} style={{ fontSize: 11 }}>
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
                {p.highShort}
              </Text>
            </Row>
            <Row>
              <Text color={lowColor} maxLines={1} style={{ fontSize: 12 }}>
                {'▼ '}
              </Text>
              <Text color={p.fg} maxLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>
                {p.lowShort}
              </Text>
            </Row>
          </Column>
        ) : null}
        {hasTides && cols > 1 ? (
          <Row modifiers={[padding(0, cols === 3 ? 4 : 2, 0, 4)]}>
            <Column modifiers={[padding(0, 0, cols === 3 ? 18 : 10, 0)]}>
              {label('▲', highColor, cols === 3 ? `High  ${p.highFt}` : 'High')}
              <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
                {p.highTime}
              </Text>
            </Column>
            <Column>
              {label('▼', lowColor, cols === 3 ? `Low  ${p.lowFt}` : 'Low')}
              <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
                {p.lowTime}
              </Text>
            </Column>
          </Row>
        ) : null}
        {hasTides && chart && chartH > 0 ? (
          <Image
            source={{ uri: chart }}
            contentScale="fillBounds"
            contentDescription="Tide chart, next 24 hours"
            modifiers={[size(chartW, chartH)]}
          />
        ) : null}
      </Column>
      {p.status ? (
        <Box modifiers={[padding(0, pad, pad, 0)]}>
          <Box modifiers={[size(10, 10), background(p.dot), cornerRadius(5)]} />
        </Box>
      ) : null}
    </Box>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
