import { StyleSheet, Text, View } from 'react-native';

import type { BeachTideProps } from '@/widgets/types';

/**
 * An in-app picture of the home-screen widget, drawn from the same props the
 * real widget gets and laid out like the Android 3x1 strip.
 */
export function BeachTidePreview({ p }: { p: BeachTideProps }) {
  const t = { color: p.fg };
  const head = p.rating ? (p.when ? `${p.rating} · ${p.when}` : p.rating) : p.beach;
  const sub = p.rating ? `${p.species} · ${p.beach}` : '';
  return (
    <View
      style={[styles.strip, { backgroundColor: p.bg }]}
      accessible
      accessibilityLabel={`Widget preview: ${[p.tideTime, p.tideLabel, head, sub, p.note].filter(Boolean).join(', ')}`}>
      {p.tideTime ? (
        <View style={styles.tide}>
          <Text style={[styles.time, t]} numberOfLines={1}>
            {p.tideTime}
          </Text>
          <Text style={[styles.small, t]} numberOfLines={1}>
            {p.tideLabel}
          </Text>
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.head, t]} numberOfLines={1}>
          {head}
        </Text>
        {sub ? (
          <Text style={[styles.sub, t]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
        {p.note ? (
          <Text style={[styles.small, t]} numberOfLines={sub ? 1 : 2}>
            {p.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    height: 76,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'center',
  },
  tide: { marginRight: 14 },
  text: { flexShrink: 1 },
  time: { fontSize: 22, fontWeight: 'bold' },
  head: { fontSize: 15, fontWeight: 'bold' },
  sub: { fontSize: 12 },
  small: { fontSize: 11 },
});
