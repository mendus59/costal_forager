/**
 * Highs and lows weeks ahead: one line per day with each high and low's time
 * and height, no hour-by-hour detail. A 1, 2, 4 or 8 week range picker sits
 * on top. Used on the station and beach pages (web and app).
 */
import { localDateKey, tideDays, type TideEvent } from '@costal-forager/core';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Chip } from '@/components/Badges';
import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtFt, fmtTime, relativeDay } from '@/lib/format';
import { WIDGET_COLORS } from '@/widgets/types';

const RANGES = [1, 2, 4, 8] as const;
type Weeks = (typeof RANGES)[number];

export function TideTable({
  tides,
  now,
  maxDays,
  goodFt = null,
  goodLabel,
}: {
  tides: readonly TideEvent[];
  now: Date;
  /** The furthest day the predictions reach; longer ranges are hidden. */
  maxDays?: number;
  /** Lows at or below this are marked in green (low enough to harvest). */
  goodFt?: number | null;
  /** "Low enough for oysters" */
  goodLabel?: string;
}) {
  const border = useThemeColor('border');
  const ranges = RANGES.filter((w) => maxDays === undefined || w === 1 || (w - 1) * 7 < maxDays);
  const [picked, setWeeks] = useState<Weeks>(4);
  // Until a longer forecast arrives, show as much as there is.
  const weeks = ranges.includes(picked) ? picked : ranges[ranges.length - 1];
  const days = useMemo(() => tideDays(tides, now, weeks * 7), [tides, now, weeks]);
  const today = localDateKey(now);

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {ranges.map((w) => (
          <Chip key={w} label={w === 1 ? '1 week' : `${w} weeks`} selected={weeks === w} onPress={() => setWeeks(w)} />
        ))}
      </View>
      {goodFt !== null && goodLabel ? (
        <Text muted style={styles.legend}>
          <Text style={{ color: WIDGET_COLORS.harvest }}>● </Text>
          {goodLabel} ({fmtFt(goodFt)} or lower)
        </Text>
      ) : null}
      {days.length === 0 && <Text muted>No predictions for the days ahead.</Text>}
      {days.map(({ key, events }) => (
        <View key={key} style={[styles.day, { borderTopColor: border }]}>
          <Text style={styles.dayHead}>{relativeDay(key, today)}</Text>
          <View style={styles.events}>
            {events.map((e) => {
              const high = e.type === 'H';
              const good = !high && goodFt !== null && e.heightFt <= goodFt;
              return (
                <Text key={e.time.toISOString()} style={styles.event}>
                  <Text style={{ color: high ? WIDGET_COLORS.high : WIDGET_COLORS.lowText }}>{high ? '▲' : '▼'} </Text>
                  <Text style={styles.when}>{fmtTime(e.time)}</Text>
                  <Text muted> {fmtFt(e.heightFt)}</Text>
                  {good ? <Text style={{ color: WIDGET_COLORS.harvest }}> ●</Text> : null}
                </Text>
              );
            })}
          </View>
        </View>
      ))}
      <Text muted style={styles.small}>
        Estimated from NOAA CO-OPS predictions (ft above MLLW). Weather and wind can shift real tides. Not for navigation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'transparent' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, backgroundColor: 'transparent' },
  legend: { fontSize: 12, marginBottom: 4 },
  day: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  dayHead: { width: 92, fontWeight: '700', fontSize: 14 },
  events: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2, backgroundColor: 'transparent' },
  event: { fontSize: 14, minWidth: 128 },
  when: { fontWeight: '600' },
  small: { fontSize: 12, marginTop: 8 },
});
