/**
 * iOS home-screen widget (WidgetKit via expo-widgets), a wide strip like the
 * Android one: rating, species and beach on the left, the low tide time on
 * the right. The layout function is serialized and run by the widget
 * extension, so it may only use its props and the SwiftUI components below.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { EMPTY_BEACH_TIDE, type BeachTideProps } from './types';

const BeachTide = (p: BeachTideProps) => {
  'widget';
  const head = p.rating ? (p.when ? `${p.rating} · ${p.when}` : p.rating) : p.beach;
  const sub = p.rating ? `${p.species} · ${p.beach}` : '';
  return (
    <HStack spacing={8} modifiers={[containerBackground(p.bg, 'widget'), widgetURL(p.url)]}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 20, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{head}</Text>
        {sub ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(p.fg), lineLimit(1)]}>{sub}</Text> : null}
        {p.note ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(p.fg), lineLimit(2)]}>{p.note}</Text> : null}
      </VStack>
      <Spacer />
      {p.tideTime ? (
        <VStack alignment="trailing" spacing={2}>
          <Text modifiers={[font({ size: 26, weight: 'bold' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.tideTime}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(p.fg), lineLimit(1)]}>{p.tideLabel}</Text>
        </VStack>
      ) : null}
    </HStack>
  );
};

export default createWidget('BeachTide', BeachTide, EMPTY_BEACH_TIDE);
