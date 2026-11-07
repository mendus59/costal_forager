/**
 * Android "Beach & species" widget (Glance via expo-widgets). The layout is
 * serialized, so it may only use its props and the Jetpack Compose components
 * below: no hooks, no app imports, no module-level values.
 */
import { Column, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps) => {
  'widget';
  return (
    <Column modifiers={[fillMaxSize(), background(p.bg), paddingAll(12)]}>
      {p.when ? (
        <Text color={p.fg} style={{ fontSize: 12, fontWeight: '600' }}>
          {p.when}
        </Text>
      ) : null}
      {p.rating ? (
        <Text color={p.fg} style={{ fontSize: 24, fontWeight: 'bold' }}>
          {p.rating}
        </Text>
      ) : null}
      {p.species ? (
        <Text color={p.fg} maxLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
          {p.species}
        </Text>
      ) : null}
      <Text color={p.fg} maxLines={1} style={{ fontSize: 12 }}>
        {p.beach}
      </Text>
      <Spacer modifiers={[weight(1)]} />
      <Text color={p.fg} maxLines={3} style={{ fontSize: 12, fontWeight: '600' }}>
        {p.low}
      </Text>
      {p.next ? (
        <Text color={p.fg} maxLines={1} style={{ fontSize: 11 }}>
          {p.next}
        </Text>
      ) : null}
    </Column>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
