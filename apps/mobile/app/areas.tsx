/**
 * Areas, ported from TideWidget: stations NOAA predicts from the same
 * reference station rise and fall nearly together, so each area near you
 * shows a window for its next high and low. Tap an area for its stations.
 */
import { areaOutlook, KM_PER_MILE, nearestN, type TideArea, type TideEvent } from '@costal-forager/core';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtTime } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { useHere } from '@/lib/location';
import { loadAreas, loadForecast } from '@/lib/tides';
import { WIDGET_COLORS } from '@/widgets/types';

/** Seattle, until the user's location is known. */
const DEFAULT_HERE = { lat: 47.6026, lng: -122.3393 };
const MAX_AREAS = 20;
/** Stations per area whose forecasts are loaded for its window. */
const MAX_LOADED = 6;

export default function AreasScreen() {
  const areas = useLoad(() => loadAreas(), []);
  const here = useHere();
  const [expanded, setExpanded] = useState<string | null>(null);
  const center = here ?? DEFAULT_HERE;
  const nearby = useMemo(
    () => (areas.data ? nearestN(center, areas.data, MAX_AREAS) : []),
    [areas.data, center.lat, center.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <FlatList
      contentContainerStyle={styles.page}
      data={nearby}
      keyExtractor={(n) => n.item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text muted style={styles.help}>
            Nearby beaches that tide together, grouped by the NOAA station they're predicted from. Use this for a general
            feel of when highs and lows come through.
          </Text>
          {here === null && (
            <Text muted style={styles.help}>
              Showing areas near Seattle. Allow location to see yours.
            </Text>
          )}
          {areas.loading && !areas.data && <ActivityIndicator style={{ marginTop: 24 }} />}
          {areas.error && <Text muted>Couldn't load NOAA's station list ({areas.error}).</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <AreaCard
          area={item.item}
          km={item.km}
          expanded={expanded === item.item.id}
          onToggle={() => setExpanded((e) => (e === item.item.id ? null : item.item.id))}
        />
      )}
    />
  );
}

function AreaCard({ area, km, expanded, onToggle }: { area: TideArea; km: number; expanded: boolean; onToggle(): void }) {
  const tint = useThemeColor('tint');
  const loaded = area.stations.slice(0, MAX_LOADED);
  const forecasts = useLoad(() => Promise.all(loaded.map((s) => loadForecast(s.id).catch(() => null))), [area.id]);
  const now = new Date();
  const byId = new Map(loaded.map((s, i) => [s.id, forecasts.data?.[i] ?? null]));
  const outlook = forecasts.data ? areaOutlook(forecasts.data.filter((f): f is TideEvent[] => !!f), now) : null;
  const mi = km / KM_PER_MILE;

  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}>
      <View card style={styles.card}>
        <Text style={styles.name}>{[area.name, area.state].filter(Boolean).join(', ')}</Text>
        <Text muted style={styles.small}>
          {area.stations.length} station{area.stations.length === 1 ? '' : 's'} · {mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi
          away
        </Text>
        {!outlook ? (
          <Text muted style={styles.small}>
            Loading tides…
          </Text>
        ) : (
          <View style={styles.windows}>
            <WindowRow label="High" color={WIDGET_COLORS.high} w={outlook.high} />
            <WindowRow label="Low" color={WIDGET_COLORS.low} w={outlook.low} />
          </View>
        )}
        {expanded ? (
          <View style={styles.members}>
            {area.stations.map((s) => {
              const ev = byId.get(s.id);
              const next = ev ? nextOf(ev, now) : null;
              return (
                <Link key={s.id} href={{ pathname: '/station/[id]', params: { id: s.id, name: s.name } }} asChild>
                  <Pressable style={styles.member} accessibilityRole="link">
                    <Text style={[styles.memberName, { color: tint }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {next ? (
                      <Text muted style={[styles.small, styles.next]} numberOfLines={1}>
                        {next}
                      </Text>
                    ) : null}
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : area.stations.length > 1 ? (
          <Text muted style={styles.tap}>
            Tap to see all stations
          </Text>
        ) : (
          <Link href={{ pathname: '/station/[id]', params: { id: area.id, name: area.name } }} style={[styles.small, { color: tint }]}>
            Week view
          </Link>
        )}
      </View>
    </Pressable>
  );
}

function WindowRow({ label, color, w }: { label: string; color: string; w: ReturnType<typeof areaOutlook>['high'] }) {
  const text = !w
    ? '—'
    : w.first.time.getTime() === w.last.time.getTime()
      ? fmtTime(w.first.time)
      : `${fmtTime(w.first.time)} – ${fmtTime(w.last.time)}`;
  return (
    <View style={styles.window}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.windowLabel}>{label}</Text>
      <Text style={styles.windowTime}>{text}</Text>
    </View>
  );
}

function nextOf(ev: TideEvent[], now: Date): string {
  const t = now.getTime();
  const high = ev.find((e) => e.type === 'H' && e.time.getTime() > t);
  const low = ev.find((e) => e.type === 'L' && e.time.getTime() > t);
  return [high && `▲ ${fmtTime(high.time)}`, low && `▼ ${fmtTime(low.time)}`].filter(Boolean).join('   ');
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10, paddingBottom: 40 },
  header: { gap: 6, marginBottom: 4 },
  help: { fontSize: 13 },
  card: { gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 12 },
  windows: { backgroundColor: 'transparent', marginTop: 6, gap: 2 },
  window: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  windowLabel: { width: 48 },
  windowTime: { fontWeight: '600' },
  tap: { fontSize: 11, marginTop: 4 },
  members: { backgroundColor: 'transparent', marginTop: 8, gap: 2 },
  member: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 5 },
  memberName: { flexShrink: 1 },
  next: { flexShrink: 0 },
});
