/**
 * iOS home-screen widget (WidgetKit via expo-widgets, systemMedium): the
 * beach and species, the next high and low tide, and a 24-hour tide chart
 * (Swift Charts), with the day's rating as a small colored dot in the
 * top-right corner. The layout function is serialized and run by the widget
 * extension, so it may only use its props and the SwiftUI components below.
 */
import { Chart, Circle, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps) => {
  'widget';
  const sub = [p.species, p.note].filter((s) => !!s).join(' · ');
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(p.bg, 'widget'), widgetURL(p.url)]}>
      <HStack spacing={6}>
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.beach}</Text>
          {sub ? <Text modifiers={[font({ size: 11 }), foregroundStyle(p.muted), lineLimit(1)]}>{sub}</Text> : null}
        </VStack>
        <Spacer />
        {p.status ? <Circle modifiers={[foregroundStyle(p.dot), frame({ width: 10, height: 10 })]} /> : null}
      </HStack>
      {p.highTime || p.lowTime ? (
        <HStack spacing={16}>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(p.muted), lineLimit(1)]}>{`▲ High ${p.highFt}`}</Text>
            <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.highTime}</Text>
          </VStack>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(p.muted), lineLimit(1)]}>{`▼ Low ${p.lowFt}`}</Text>
            <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.lowTime}</Text>
          </VStack>
        </HStack>
      ) : null}
      {p.bars.length > 0 ? (
        <Chart
          type="bar"
          data={p.bars.map((b, i) => ({ x: i, y: 0.1 + b.h, color: b.c }))}
          barStyle={{ cornerRadius: 2 }}
          modifiers={[frame({ maxWidth: 10000, minHeight: 30, maxHeight: 40 })]}
        />
      ) : null}
    </VStack>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
