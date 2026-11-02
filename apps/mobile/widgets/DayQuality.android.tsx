/**
 * Android home-screen widget (Glance via expo-widgets). Same rules as the iOS
 * file: the layout is serialized, so it may only use its props and the
 * Jetpack Compose components below.
 */
import { Column, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_WIDGET, type DayQualityProps } from './types';

const DayQuality = (p: DayQualityProps) => {
  'widget';
  return (
    <Column modifiers={[fillMaxSize(), background(p.bg), paddingAll(12)]}>
      <Text color={p.fg} style={{ fontSize: 12, fontWeight: '600' }}>
        {p.when}
      </Text>
      {p.rating ? (
        <Text color={p.fg} style={{ fontSize: 26, fontWeight: 'bold' }}>
          {p.rating}
        </Text>
      ) : null}
      {p.species ? (
        <Text color={p.fg} maxLines={1} style={{ fontSize: 15, fontWeight: '600' }}>
          {p.species}
        </Text>
      ) : null}
      <Text color={p.fg} maxLines={1} style={{ fontSize: 12 }}>
        {p.beach}
      </Text>
      <Spacer modifiers={[weight(1)]} />
      <Text color={p.fg} maxLines={2} style={{ fontSize: 11 }}>
        {p.detail}
      </Text>
      {p.next ? (
        <Text color={p.fg} maxLines={1} style={{ fontSize: 11, fontWeight: '600' }}>
          {p.next}
        </Text>
      ) : null}
    </Column>
  );
};

export default createWidget('DayQuality', DayQuality, EMPTY_WIDGET);
