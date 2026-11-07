/**
 * iOS "Beach & species" widget (WidgetKit via expo-widgets). Same rules as
 * DayQuality.ios.tsx: only props, environment and SwiftUI components.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps, env: WidgetEnvironment) => {
  'widget';
  const small = env.widgetFamily === 'systemSmall';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(p.bg, 'widget'), widgetURL(p.url)]}>
      <HStack>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(p.fg)]}>{p.when}</Text>
        <Spacer />
      </HStack>
      {p.rating ? (
        <Text modifiers={[font({ size: small ? 24 : 28, weight: 'bold' }), foregroundStyle(p.fg)]}>{p.rating}</Text>
      ) : null}
      {p.species ? (
        <Text modifiers={[font({ textStyle: 'headline' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.species}</Text>
      ) : null}
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.beach}</Text>
      <Spacer />
      <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(p.fg), lineLimit(small ? 3 : 2)]}>
        {p.low}
      </Text>
      {p.next ? (
        <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.next}</Text>
      ) : null}
    </VStack>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
