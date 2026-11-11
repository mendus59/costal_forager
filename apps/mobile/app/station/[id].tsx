/**
 * A NOAA tide station's week, ported from TideWidget's station sheet: the
 * water height now, a 24-hour or 7-day tide curve, every high and low for the
 * next 7 days grouped by day, and a button to put the station on the
 * home-screen widget. Opened from the tide map, the Areas list, a beach page
 * or the widget (coastalforager://station/<id>).
 */
import {
  areaOutlook,
  groupAreas,
  localDateKey,
  stationLabel,
  tideChartPng,
  tideHeightAt,
  toBase64,
  type TideEvent,
} from '@costal-forager/core';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/Badges';
import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtFt, fmtTime, relativeDay } from '@/lib/format';
import { useLoad } from '@/lib/hooks';
import { useUser } from '@/lib/store';
import { loadForecast, loadUsStations } from '@/lib/tides';
import { WIDGET_COLORS } from '@/widgets/types';

const CHART_H = 140;
const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' });

export default function StationScreen() {
  const { id, name: nameParam } = useLocalSearchParams<{ id: string; name?: string }>();
  const forecast = useLoad(() => loadForecast(id), [id]);
  const stations = useLoad(() => loadUsStations(), []);
  const { widget, setWidget } = useUser();
  const tint = useThemeColor('tint');
  const [hours, setHours] = useState<24 | 168>(168);
  const [width, setWidth] = useState(0);

  const station = stations.data?.find((s) => s.id === id);
  const name = station?.name ?? nameParam ?? `Station ${id}`;
  const title = station ? stationLabel(station) : name;
  const area = useMemo(() => {
    if (!stations.data || !station) return null;
    const ref = station.referenceId ?? station.id;
    return groupAreas(stations.data.filter((s) => s.id === ref || s.referenceId === ref)).find((a) => a.id === ref) ?? null;
  }, [stations.data, station]);

  const now = useMemo(() => new Date(), [forecast.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const tides = forecast.data;
  const heightNow = tides ? tideHeightAt(tides, now) : null;

  const chart = useMemo(() => {
    if (!tides || width <= 0) return null;
    const png = tideChartPng(tides, {
      width: Math.round(width * 2),
      height: CHART_H * 2,
      from: now,
      to: new Date(now.getTime() + hours * 3600000),
      scale: hours > 24 ? 1.4 : 2,
    });
    return png ? `data:image/png;base64,${toBase64(png)}` : null;
  }, [tides, width, hours, now]);

  const ticks = useMemo(() => {
    if (hours === 24) return ['Now', '+6h', '+12h', '+18h', '+24h'];
    return Array.from({ length: 8 }, (_, i) =>
      i === 0 ? 'Now' : weekday.format(new Date(`${localDateKey(new Date(now.getTime() + i * 86400000))}T12:00:00Z`)),
    );
  }, [hours, now]);

  const days = useMemo(() => groupByDay(tides ?? [], now), [tides, now]);
  const today = localDateKey(now);
  const onWidget = !widget.bidn && widget.station?.id === id;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: name }} />
      <View card>
        <Text style={styles.h1}>{title}</Text>
        <Text muted>
          NOAA station {id}
          {heightNow !== null ? ` · ${fmtFt(heightNow)} now` : ''}
        </Text>
        <View style={styles.range}>
          <Chip label="24 hours" selected={hours === 24} onPress={() => setHours(24)} />
          <Chip label="7 days" selected={hours === 168} onPress={() => setHours(168)} />
        </View>
        <View style={styles.chartBox} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {chart ? (
            <Image
              source={{ uri: chart }}
              style={{ width: '100%', height: CHART_H }}
              resizeMode="stretch"
              accessibilityLabel={`Tide curve, next ${hours === 24 ? '24 hours' : '7 days'}`}
            />
          ) : forecast.loading ? (
            <ActivityIndicator style={{ height: CHART_H }} />
          ) : (
            <Text muted style={{ height: CHART_H }}>
              {forecast.error ? `Couldn't load predictions (${forecast.error})` : 'No predictions'}
            </Text>
          )}
        </View>
        <View style={styles.axis}>
          {ticks.map((t, i) => (
            <Text key={i} muted style={styles.tick}>
              {t}
            </Text>
          ))}
        </View>
        {Platform.OS !== 'web' && (
          <Pressable
            accessibilityRole="button"
            disabled={onWidget}
            onPress={() => setWidget({ bidn: null, species: null, station: { id, name } })}
            style={styles.widgetButton}>
            <Text style={{ color: tint, fontSize: 14 }}>
              {onWidget ? '✓ This station is on your home-screen widget' : 'Show this station on my home-screen widget'}
            </Text>
          </Pressable>
        )}
      </View>

      {area && area.stations.length > 1 && (
        <AreaCard area={area} here={id} now={now} />
      )}

      <View card>
        <Text style={styles.h2}>Highs and lows</Text>
        {days.map(({ key, events }) => (
          <View key={key} style={styles.day}>
            <Text style={styles.dayHead}>{relativeDay(key, today)}</Text>
            {events.map((e) => (
              <View key={e.time.toISOString()} style={styles.event}>
                <Text style={[styles.kind, { color: e.type === 'H' ? WIDGET_COLORS.high : WIDGET_COLORS.lowText }]}>
                  {e.type === 'H' ? '▲ High' : '▼ Low'}
                </Text>
                <Text style={styles.when}>{fmtTime(e.time)}</Text>
                <Text muted>{fmtFt(e.heightFt)}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text muted style={styles.small}>
          Predictions from NOAA CO-OPS (MLLW). Not for navigation.
        </Text>
      </View>
      <Link href="/areas" style={[styles.link, { color: tint }]}>
        See all areas near you
      </Link>
    </ScrollView>
  );
}

/** The other stations NOAA predicts from the same reference, and when the next tides come through them. */
function AreaCard({ area, here, now }: { area: ReturnType<typeof groupAreas>[number]; here: string; now: Date }) {
  const tint = useThemeColor('tint');
  const members = area.stations.slice(0, 12);
  const forecasts = useLoad(
    () => Promise.all(members.map((s) => loadForecast(s.id).catch(() => null))),
    [area.id],
  );
  const outlook = forecasts.data ? areaOutlook(forecasts.data.filter((f): f is TideEvent[] => !!f), now) : null;
  const window = (w: ReturnType<typeof areaOutlook>['high']) =>
    !w ? '—' : w.first.time.getTime() === w.last.time.getTime() ? fmtTime(w.first.time) : `${fmtTime(w.first.time)} – ${fmtTime(w.last.time)}`;
  return (
    <View card>
      <Text style={styles.h2}>Tides together with</Text>
      <Text muted style={styles.small}>
        NOAA predicts these {area.stations.length} stations from {area.name}, so they rise and fall nearly in step.
      </Text>
      {outlook ? (
        <View style={styles.outlook}>
          <Text>
            <Text style={{ color: WIDGET_COLORS.high }}>▲ </Text>Next high {window(outlook.high)}
          </Text>
          <Text>
            <Text style={{ color: WIDGET_COLORS.lowText }}>▼ </Text>Next low {window(outlook.low)}
          </Text>
        </View>
      ) : (
        <ActivityIndicator style={{ marginVertical: 8 }} />
      )}
      {members
        .filter((s) => s.id !== here)
        .map((s) => (
          <Link key={s.id} href={{ pathname: '/station/[id]', params: { id: s.id, name: s.name } }} style={[styles.member, { color: tint }]}>
            {s.name}
          </Link>
        ))}
    </View>
  );
}

function groupByDay(tides: TideEvent[], now: Date): { key: string; events: TideEvent[] }[] {
  const end = now.getTime() + 7 * 86400000;
  const out: { key: string; events: TideEvent[] }[] = [];
  for (const e of tides) {
    const t = e.time.getTime();
    if (t <= now.getTime() || t > end) continue;
    const key = localDateKey(e.time);
    const last = out[out.length - 1];
    if (last && last.key === key) last.events.push(e);
    else out.push({ key, events: [e] });
  }
  return out;
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  range: { flexDirection: 'row', marginTop: 10, backgroundColor: 'transparent' },
  chartBox: { marginTop: 8, backgroundColor: 'transparent' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent', marginTop: 2 },
  tick: { fontSize: 11 },
  widgetButton: { paddingVertical: 8, marginTop: 4 },
  day: { backgroundColor: 'transparent', marginTop: 8 },
  dayHead: { fontWeight: '700', marginBottom: 2 },
  event: { flexDirection: 'row', gap: 12, paddingVertical: 2, backgroundColor: 'transparent' },
  kind: { width: 64 },
  when: { width: 78, fontWeight: '600' },
  small: { fontSize: 12, marginTop: 8 },
  outlook: { backgroundColor: 'transparent', marginVertical: 6, gap: 2 },
  member: { fontSize: 14, paddingVertical: 4 },
  link: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
});
