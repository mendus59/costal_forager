/**
 * Android home-screen widget (Glance via expo-widgets), a 3x1 strip on the
 * rating's color: the low tide time first, then rating, species and beach.
 *
 * The layout is serialized, so it may only use its props and the Jetpack
 * Compose components below: no hooks, no app imports, no module-level values.
 * expo-widgets ignores the `weight` modifier on Android, so nothing here can
 * stretch to push content right; the short tide time goes first and the
 * longer text after it, where it is cut off at the widget's edge if needed.
 */
import { Column, Row, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, padding } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps) => {
  'widget';
  const head = p.rating ? (p.when ? `${p.rating} · ${p.when}` : p.rating) : p.beach;
  const sub = p.rating ? `${p.species} · ${p.beach}` : '';
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxSize(), background(p.bg), padding(14, 4, 12, 4)]}>
      {p.tideTime ? (
        <Column modifiers={[padding(0, 0, 14, 0)]}>
          <Text color={p.fg} maxLines={1} style={{ fontSize: 22, fontWeight: 'bold' }}>
            {p.tideTime}
          </Text>
          <Text color={p.fg} maxLines={1} style={{ fontSize: 11 }}>
            {p.tideLabel}
          </Text>
        </Column>
      ) : null}
      <Column>
        <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: 'bold' }}>
          {head}
        </Text>
        {sub ? (
          <Text color={p.fg} maxLines={1} style={{ fontSize: 12 }}>
            {sub}
          </Text>
        ) : null}
        {p.note ? (
          <Text color={p.fg} maxLines={sub ? 1 : 2} style={{ fontSize: 11 }}>
            {p.note}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
