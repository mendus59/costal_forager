import { localDateKey, SPECIES, type SpeciesId } from '@costal-forager/core';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/Badges';
import { Text, View } from '@/components/Themed';
import { BeachMap } from '@/components/map/BeachMap';
import type { MapData } from '@/components/map/mapHtml';
import { useColorScheme } from '@/components/useColorScheme';
import { useBeaches } from '@/lib/hooks';
import { MAP_STATE_STYLE, mapLabel, mapState, type MapState } from '@/lib/map-status';
import { speciesName } from '@/lib/species';
import { useUser } from '@/lib/store';

const DRAW_ORDER = { unknown: 0, closed: 1, caution: 2, open: 3 } as const;

export default function MapScreen() {
  const beaches = useBeaches();
  const { favoriteSpecies } = useUser();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [species, setSpecies] = useState<SpeciesId | null>(null);
  const today = localDateKey(new Date());

  // Favorite species first, then the rest, so every species can be picked.
  const speciesChips = useMemo(
    () => [...favoriteSpecies, ...SPECIES.map((s) => s.id).filter((id) => !favoriteSpecies.includes(id))],
    [favoriteSpecies],
  );

  const { data, counts } = useMemo(() => {
    const counts: Record<MapState, number> = { open: 0, caution: 0, closed: 0, unknown: 0, absent: 0 };
    const placed: { state: Exclude<MapState, 'absent'>; point: MapData['points'][number] }[] = [];
    for (const b of beaches.data ?? []) {
      if (!b.location) continue;
      const state = mapState(b, species, today);
      counts[state]++;
      if (state === 'absent') continue;
      placed.push({
        state,
        point: {
          bidn: b.bidn,
          name: b.name,
          lat: b.location.lat,
          lng: b.location.lng,
          color: MAP_STATE_STYLE[state].color,
          label: mapLabel(state, species),
        },
      });
    }
    // Draw open beaches last so they sit on top where markers overlap.
    placed.sort((a, b) => DRAW_ORDER[a.state] - DRAW_ORDER[b.state]);
    const points = placed.map((p) => p.point);
    return { data: { points, dark } satisfies MapData, counts };
  }, [beaches.data, species, today, dark]);

  const open = useCallback(
    (bidn: string) => router.push({ pathname: '/beach/[bidn]', params: { bidn } }),
    [router],
  );

  return (
    <View style={styles.page}>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All beaches" selected={species === null} onPress={() => setSpecies(null)} />
          {speciesChips.map((id) => (
            <Chip
              key={id}
              label={speciesName(id)}
              selected={species === id}
              onPress={() => setSpecies((s) => (s === id ? null : id))}
            />
          ))}
        </ScrollView>
        <Text muted style={styles.summary}>
          {beaches.data
            ? species
              ? `${counts.open + counts.caution} beaches open for ${speciesName(species).toLowerCase()} today`
              : `${counts.open + counts.caution} of ${counts.open + counts.caution + counts.closed + counts.unknown} beaches open today`
            : ' '}
        </Text>
        <View style={styles.legend}>
          {(Object.keys(MAP_STATE_STYLE) as (keyof typeof MAP_STATE_STYLE)[])
            .filter((k) => k !== 'unknown' || counts.unknown > 0)
            .map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: MAP_STATE_STYLE[k].color }]} />
              <Text muted style={styles.legendText}>
                {MAP_STATE_STYLE[k].label} ({counts[k]})
              </Text>
            </View>
          ))}
        </View>
      </View>

      {beaches.error && !beaches.data ? (
        <Text style={{ padding: 16 }}>Couldn't load beaches: {beaches.error}</Text>
      ) : (
        <View style={styles.mapWrap}>
          <BeachMap data={data} onOpen={open} />
          {beaches.loading && !beaches.data ? <ActivityIndicator style={styles.spinner} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 10 },
  chips: { paddingBottom: 2 },
  summary: { fontSize: 13, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
  mapWrap: { flex: 1 },
  spinner: { position: 'absolute', top: 24, alignSelf: 'center' },
});
