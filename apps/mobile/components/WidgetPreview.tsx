import { StyleSheet, Text, View } from 'react-native';

import type { BeachTideProps } from '@/widgets/types';

/**
 * An in-app picture of the "Beach & species" home-screen widget, drawn from
 * the same props the real widget gets, at about a 2x2 home-screen size.
 */
export function BeachTidePreview({ p }: { p: BeachTideProps }) {
  const t = { color: p.fg };
  return (
    <View
      style={[styles.tile, { backgroundColor: p.bg }]}
      accessible
      accessibilityLabel={`Widget preview: ${[p.when, p.rating, p.species, p.beach, p.low, p.next].filter(Boolean).join(', ')}`}>
      {p.when ? <Text style={[styles.when, t]}>{p.when}</Text> : null}
      {p.rating ? <Text style={[styles.rating, t]}>{p.rating}</Text> : null}
      {p.species ? (
        <Text style={[styles.species, t]} numberOfLines={1}>
          {p.species}
        </Text>
      ) : null}
      <Text style={[styles.beach, t]} numberOfLines={1}>
        {p.beach}
      </Text>
      <View style={styles.spacer} />
      <Text style={[styles.low, t]} numberOfLines={3}>
        {p.low}
      </Text>
      {p.next ? (
        <Text style={[styles.next, t]} numberOfLines={1}>
          {p.next}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 170, height: 170, borderRadius: 22, padding: 12, marginTop: 8, alignSelf: 'center' },
  when: { fontSize: 12, fontWeight: '600' },
  rating: { fontSize: 24, fontWeight: 'bold' },
  species: { fontSize: 14, fontWeight: '600' },
  beach: { fontSize: 12 },
  spacer: { flex: 1 },
  low: { fontSize: 12, fontWeight: '600' },
  next: { fontSize: 11 },
});
