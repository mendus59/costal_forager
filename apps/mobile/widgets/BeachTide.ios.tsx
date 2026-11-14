/**
 * iOS home-screen widget (WidgetKit via expo-widgets, systemMedium): the
 * beach and species, the water height now, the next high and low tide, and a 24-hour tide chart
 * drawn like TideWidget's (Swift Charts: a filled curve with a dot on each
 * high and low, and a gray dot along the bottom at now), with the day's
 * rating as a small colored dot in the top-right corner. The layout function is serialized and run by the widget
 * extension, so it may only use its props and the SwiftUI components below.
 */
import { Chart, Circle, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
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
          {p.nowFt ? (
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 10 }), foregroundStyle(p.muted), lineLimit(1)]}>Now</Text>
              <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.nowFt}</Text>
            </VStack>
          ) : null}
        </HStack>
      ) : null}
      {p.curve.length > 0 ? (
        <ZStack modifiers={[frame({ maxWidth: 10000, minHeight: 30, maxHeight: 44 })]}>
          <Chart
            type="area"
            data={p.curve.map((y, i) => ({ x: i, y }))}
            areaStyle={{ color: '#2159cc55' }}
            modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}
          />
          <Chart
            type="line"
            data={p.curve.map((y, i) => ({ x: i, y }))}
            lineStyle={{ color: '#2159cc', width: 2.2 }}
            modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}
          />
          <Chart
            type="point"
            data={[
              ...p.turns.map((t) => ({ x: t.x, y: t.y, color: t.high ? '#e03833' : '#2159cc' })),
              { x: p.nowX, y: 0, color: '#88888899' },
              // Clear corner points keep this chart's axes the same as the curve's.
              { x: 0, y: 0, color: '#00000000' },
              { x: p.curve.length - 1, y: 1, color: '#00000000' },
            ]}
            pointStyle={{ pointStyle: 'circle', pointSize: 7 }}
            modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}
          />
        </ZStack>
      ) : null}
    </VStack>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
