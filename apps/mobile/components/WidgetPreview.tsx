import { StyleSheet, Text, View } from 'react-native';

import type { BeachTideProps } from '@/widgets/types';

/**
 * An in-app picture of the home-screen widget, drawn from the same props the
 * real widget gets and laid out like the Android 3x2 widget.
 */
export function BeachTidePreview({ p }: { p: BeachTideProps }) {
  const sub = [p.species, p.note].filter(Boolean).join(' · ');
  const tides = p.highTime || p.lowTime;
  return (
    <View
      style={[styles.card, { backgroundColor: p.bg }]}
      accessible
      accessibilityLabel={`Widget preview: ${[
        p.beach,
        sub,
        p.status,
        tides ? `next high ${p.highTime} ${p.highFt}, next low ${p.lowTime} ${p.lowFt}` : '',
      ]
        .filter(Boolean)
        .join(', ')}`}>
      {p.status ? <View style={[styles.dot, { backgroundColor: p.dot }]} /> : null}
      <Text style={[styles.beach, { color: p.fg }]} numberOfLines={1}>
        {p.beach}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: p.muted }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
      {tides ? (
        <View style={styles.tides}>
          <View style={styles.tide}>
            <Text style={[styles.label, { color: p.muted }]}>{`▲ High ${p.highFt}`}</Text>
            <Text style={[styles.time, { color: p.fg }]}>{p.highTime}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: p.muted }]}>{`▼ Low ${p.lowFt}`}</Text>
            <Text style={[styles.time, { color: p.fg }]}>{p.lowTime}</Text>
          </View>
        </View>
      ) : null}
      {p.bars.length > 0 ? (
        <View style={styles.chart}>
          {p.bars.map((b, i) => (
            <View key={i} style={[styles.bar, { height: 3 + Math.round(b.h * 29), backgroundColor: b.c }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 320,
    minHeight: 110,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    alignSelf: 'center',
  },
  dot: { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },
  beach: { fontSize: 14, fontWeight: 'bold', marginRight: 18 },
  sub: { fontSize: 11 },
  tides: { flexDirection: 'row', marginVertical: 4 },
  tide: { marginRight: 16 },
  label: { fontSize: 10 },
  time: { fontSize: 15, fontWeight: 'bold' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 32 },
  bar: { width: 5, borderRadius: 2 },
});
