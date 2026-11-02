/**
 * iOS home-screen widget (WidgetKit via expo-widgets). The layout function is
 * serialized and run by the widget extension, so it may only use its props,
 * environment and the SwiftUI components below: no hooks, no app imports,
 * no module-level values.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_WIDGET, type DayQualityProps } from './types';

const DayQuality = (p: DayQualityProps, env: WidgetEnvironment) => {
  'widget';
  const small = env.widgetFamily === 'systemSmall';
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(p.bg, 'widget'), widgetURL(p.url)]}>
      <HStack>
        <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(p.fg)]}>{p.when}</Text>
        <Spacer />
      </HStack>
      {p.rating ? (
        <Text modifiers={[font({ size: small ? 26 : 30, weight: 'bold' }), foregroundStyle(p.fg)]}>{p.rating}</Text>
      ) : null}
      {p.species ? (
        <Text modifiers={[font({ textStyle: 'headline' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.species}</Text>
      ) : null}
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(p.fg), lineLimit(small ? 1 : 2)]}>{p.beach}</Text>
      <Spacer />
      <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(p.fg), lineLimit(small ? 2 : 1)]}>{p.detail}</Text>
      {!small && p.next ? (
        <Text modifiers={[font({ textStyle: 'caption2', weight: 'semibold' }), foregroundStyle(p.fg), lineLimit(1)]}>
          {p.next}
        </Text>
      ) : null}
    </VStack>
  );
};

export default createWidget('DayQuality', DayQuality, EMPTY_WIDGET);
