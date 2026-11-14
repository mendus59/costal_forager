/**
 * The water height hour by hour: a row for now, then one for each hour ahead,
 * with a bar for the height, which way the water is going, and each high and
 * low slotted in at its time. Used on the station and beach pages (web and
 * app). Heights between NOAA's highs and lows follow the same curve as the
 * charts and the widget (tideHeightAt).
 */
import { localDateKey, tideHeightAt, tideRising, WA_TZ, type TideEvent } from '@costal-forager/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtFt, fmtTime, relativeDay } from '@/lib/format';
import { WIDGET_COLORS } from '@/widgets/types';

const HOUR = 3600000;
const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: WA_TZ, hour: 'numeric' });

type Row =
  | { kind: 'hour'; time: Date; ft: number; rising: boolean | null; now: boolean }
  | { kind: 'turn'; time: Date; ft: number; high: boolean };

/** The rows from `now` through `hours` ahead: now, each whole hour, and the highs and lows between. */
export function hourlyRows(tides: readonly TideEvent[], now: Date, hours: number): Row[] {
  const end = now.getTime() + hours * HOUR;
  const rows: Row[] = [];
  const add = (t: number, isNow: boolean) => {
    const time = new Date(t);
    const ft = tideHeightAt(tides, time);
    if (ft !== null) rows.push({ kind: 'hour', time, ft, rising: tideRising(tides, time), now: isNow });
  };
  add(now.getTime(), true);
  for (let t = Math.floor(now.getTime() / HOUR) * HOUR + HOUR; t <= end; t += HOUR) add(t, false);
  for (const e of tides) {
    const t = e.time.getTime();
    if (t > now.getTime() && t <= end) rows.push({ kind: 'turn', time: e.time, ft: e.heightFt, high: e.type === 'H' });
  }
  return rows.sort((a, b) => a.time.getTime() - b.time.getTime());
}

export function HourlyTides({
  tides,
  now,
  goodFt = null,
  goodLabel,
}: {
  tides: readonly TideEvent[];
  now: Date;
  /** Heights at or below this show in green (low enough to harvest). */
  goodFt?: number | null;
  /** "Low enough for oysters" */
  goodLabel?: string;
}) {
  const tint = useThemeColor('tint');
  const track = useThemeColor('border');
  const [hours, setHours] = useState<24 | 48>(24);
  const rows = useMemo(() => hourlyRows(tides, now, hours), [tides, now, hours]);
  if (rows.length === 0) return <Text muted>No predictions for the hours ahead.</Text>;

  const heights = rows.map((r) => r.ft);
  const lo = Math.min(...heights);
  const hi = Math.max(Math.max(...heights), lo + 0.1);
  const today = localDateKey(now);
  let lastDay = today;

  return (
    <View style={styles.wrap}>
      {goodFt !== null && goodLabel ? (
        <Text muted style={styles.legend}>
          <Text style={{ color: WIDGET_COLORS.harvest }}>■ </Text>
          {goodLabel} ({fmtFt(goodFt)} or lower)
        </Text>
      ) : null}
      {rows.map((r) => {
        const day = localDateKey(r.time);
        const head = day !== lastDay ? relativeDay(day, today) : null;
        lastDay = day;
        const key = `${r.kind}${r.time.getTime()}`;
        if (r.kind === 'turn') {
          return (
            <View key={key} style={styles.wrapRow}>
              {head ? <Text style={styles.day}>{head}</Text> : null}
              <View style={styles.row}>
                <Text style={[styles.turn, { color: r.high ? WIDGET_COLORS.high : WIDGET_COLORS.lowText }]}>
                  {r.high ? '▲ High' : '▼ Low'} {fmtTime(r.time)}
                </Text>
                <Text style={styles.turnFt}>{fmtFt(r.ft)}</Text>
              </View>
            </View>
          );
        }
        const good = goodFt !== null && r.ft <= goodFt;
        const pct = 6 + ((r.ft - lo) / (hi - lo)) * 94;
        return (
          <View key={key} style={styles.wrapRow}>
            {head ? <Text style={styles.day}>{head}</Text> : null}
            <View style={styles.row} accessible accessibilityLabel={`${r.now ? 'Now' : hourFmt.format(r.time)}: ${fmtFt(r.ft)}, ${r.rising ? 'rising' : 'falling'}`}>
              <Text style={[styles.hour, r.now && { color: tint, fontWeight: '700' }]}>{r.now ? 'Now' : hourFmt.format(r.time)}</Text>
              <View style={[styles.track, { backgroundColor: track }]}>
                <View
                  style={[
                    styles.bar,
                    { width: `${pct}%`, backgroundColor: good ? WIDGET_COLORS.harvest : WIDGET_COLORS.water },
                    r.now && { backgroundColor: tint },
                  ]}
                />
              </View>
              <Text style={[styles.ft, r.now && { fontWeight: '700' }]}>{fmtFt(r.ft)}</Text>
              <Text muted style={styles.dir}>
                {r.rising === null ? '' : r.rising ? '↑' : '↓'}
              </Text>
            </View>
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={() => setHours(hours === 24 ? 48 : 24)} style={styles.more}>
        <Text style={{ color: tint, fontSize: 14 }}>{hours === 24 ? 'Show 48 hours' : 'Show 24 hours'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'transparent', marginTop: 4 },
  legend: { fontSize: 12, marginBottom: 6 },
  wrapRow: { backgroundColor: 'transparent' },
  day: { fontWeight: '700', marginTop: 8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, backgroundColor: 'transparent' },
  hour: { width: 48, fontSize: 13 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
  ft: { width: 64, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  dir: { width: 14, fontSize: 13 },
  turn: { flex: 1, fontSize: 12, fontWeight: '600', paddingLeft: 56 },
  turnFt: { width: 64, fontSize: 12, textAlign: 'right', marginRight: 22 },
  more: { paddingVertical: 8, marginTop: 4 },
});
