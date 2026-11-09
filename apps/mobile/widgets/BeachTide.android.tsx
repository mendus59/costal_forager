/**
 * Android home-screen widget (Glance via expo-widgets), 3x2 by default: the
 * beach and species, the next high and low tide, and a 24-hour tide chart,
 * with the day's rating as a small colored dot in the top-right corner.
 *
 * The layout is serialized, so it may only use its props and the Jetpack
 * Compose components below: no hooks, no app imports, no module-level values.
 * Glance has no canvas, so the chart is a row of hourly bars (fixed-size
 * boxes), and expo-widgets ignores the `weight` modifier on Android, so
 * nothing here stretches: everything has a fixed size or wraps its content.
 */
import { Box, Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, padding, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps) => {
  'widget';
  const sub = [p.species, p.note].filter((s) => !!s).join(' · ');
  return (
    <Box contentAlignment="topEnd" modifiers={[fillMaxSize(), background(p.bg), cornerRadius(16)]}>
      <Column modifiers={[fillMaxSize(), padding(12, 8, 12, 8)]}>
        <Text color={p.fg} maxLines={1} style={{ fontSize: 14, fontWeight: 'bold' }}>
          {p.beach}
        </Text>
        {sub ? (
          <Text color={p.muted} maxLines={1} style={{ fontSize: 11 }}>
            {sub}
          </Text>
        ) : null}
        {p.highTime || p.lowTime ? (
          <Row modifiers={[padding(0, 4, 0, 4)]}>
            <Column modifiers={[padding(0, 0, 16, 0)]}>
              <Text color={p.muted} maxLines={1} style={{ fontSize: 10 }}>
                {`▲ High ${p.highFt}`}
              </Text>
              <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
                {p.highTime}
              </Text>
            </Column>
            <Column>
              <Text color={p.muted} maxLines={1} style={{ fontSize: 10 }}>
                {`▼ Low ${p.lowFt}`}
              </Text>
              <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
                {p.lowTime}
              </Text>
            </Column>
          </Row>
        ) : null}
        {p.bars.length > 0 ? (
          <Row verticalAlignment="bottom">
            {p.bars.map((b, i) => (
              <Box key={i} modifiers={[padding(0, 0, 1, 0)]}>
                <Box modifiers={[size(5, 3 + Math.round(b.h * 29)), background(b.c), cornerRadius(2)]} />
              </Box>
            ))}
          </Row>
        ) : null}
      </Column>
      {p.status ? (
        <Box modifiers={[padding(0, 10, 10, 0)]}>
          <Box modifiers={[size(10, 10), background(p.dot), cornerRadius(5)]} />
        </Box>
      ) : null}
    </Box>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
