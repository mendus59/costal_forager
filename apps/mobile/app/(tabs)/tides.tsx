/**
 * The tide map, ported from TideWidget: every NOAA tide station as a dot
 * colored by the tide (blue low through red high), a slider and play button
 * to sweep the next 24 hours, and search for places and stations. Tapping a
 * station's "Week view" opens its 7-day page.
 */
import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { TideMap } from '@/components/map/TideMap';
import type { StationPick, TideMapData } from '@/components/map/tideMapHtml';
import { useColorScheme } from '@/components/useColorScheme';
import { useHere } from '@/lib/location';

export default function TidesScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const here = useHere();
  const tint = useThemeColor('tint');
  const data = useMemo<TideMapData>(() => ({ dark, center: here ?? null }), [dark, here]);
  const open = useCallback(
    (s: StationPick) => router.push({ pathname: '/station/[id]', params: { id: s.id, name: s.name } }),
    [router],
  );
  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/areas" asChild>
              <Pressable accessibilityRole="link" style={styles.headerButton}>
                <Text style={{ color: tint, fontSize: 16 }}>Areas</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <TideMap data={data} onStation={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headerButton: { paddingHorizontal: 16, paddingVertical: 6 },
});
