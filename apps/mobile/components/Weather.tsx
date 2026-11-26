/**
 * Weather and wind from Open-Meteo: a full card for beach and station pages
 * (now, the next 24 hours, the next 7 days) and a one-line summary for the
 * Today tab. Wind arrows point the way the wind blows; the text names the
 * direction it comes from, as forecasts do ("12 mph SW" = from the southwest).
 */
import { compassDir, localDateKey, OPEN_METEO_CREDIT, WA_TZ, weatherLabel, type Weather } from '@costal-forager/core';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { ExternalLink } from '@/components/ExternalLink';
import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtTime, relativeDay } from '@/lib/format';
import type { Loadable } from '@/lib/hooks';

const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: WA_TZ, hour: 'numeric' });
const deg = (f: number) => `${Math.round(f)}°`;
const mph = (m: number) => `${Math.round(m)} mph`;

/** "12 mph SW, gusts 20" (gusts only when they add something). */
export function windText(w: { windMph: number; gustMph: number; windDeg: number }): string {
  if (Math.round(w.windMph) === 0) return 'Calm';
  const gust = Math.round(w.gustMph) >= Math.round(w.windMph) + 5 ? `, gusts ${Math.round(w.gustMph)}` : '';
  return `${mph(w.windMph)} ${compassDir(w.windDeg)}${gust}`;
}

/** An arrow pointing where the wind is going (it comes from `windDeg`). */
function WindArrow({ windDeg, size = 14 }: { windDeg: number; size?: number }) {
  return (
    <Text
      accessible={false}
      style={{ fontSize: size, lineHeight: size + 2, transform: [{ rotate: `${Math.round(windDeg)}deg` }] }}>
      ↓
    </Text>
  );
}

/** "☁️ 47°F Overcast · Wind 12 mph SW" for the Today tab. */
export function WeatherLine({ weather }: { weather: Loadable<Weather | null> }) {
  const w = weather.data?.now;
  if (!w) return null;
  const { label, icon } = weatherLabel(w.code, w.isDay);
  return (
    <Text muted style={styles.line} accessibilityLabel={`Now ${deg(w.tempF)}F, ${label}, wind ${windText(w)}`}>
      {icon} {deg(w.tempF)}F {label} · Wind {windText(w)}
    </Text>
  );
}

export function WeatherCard({ weather }: { weather: Loadable<Weather | null> }) {
  const tint = useThemeColor('tint');
  const border = useThemeColor('border');
  const w = weather.data;

  if (!w) {
    if (weather.loading) return <ActivityIndicator style={{ marginVertical: 8 }} />;
    return weather.error ? <Text muted>Weather unavailable: {weather.error}</Text> : null;
  }

  const now = w.now;
  const { label, icon } = weatherLabel(now.code, now.isDay);
  const startHour = Math.floor(Date.now() / 3600000) * 3600000;
  const hours = w.hours.filter((h) => h.time.getTime() > startHour).slice(0, 24);
  const today = localDateKey(new Date());
  const days = w.days.filter((d) => d.date >= today);

  return (
    <View style={styles.wrap}>
      <View style={styles.now}>
        <Text style={styles.bigIcon}>{icon}</Text>
        <View style={styles.nowText}>
          <Text style={styles.temp}>{deg(now.tempF)}F</Text>
          <Text>{label}</Text>
        </View>
        <View style={styles.nowWind}>
          <WindArrow windDeg={now.windDeg} size={22} />
          <Text style={styles.windBig}>Wind {windText(now)}</Text>
        </View>
      </View>

      {hours.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
          {hours.map((h) => {
            const l = weatherLabel(h.code, h.isDay);
            return (
              <View
                key={h.time.getTime()}
                style={[styles.hour, { borderColor: border }]}
                accessible
                accessibilityLabel={`${hourFmt.format(h.time)}: ${deg(h.tempF)}F, ${l.label}, wind ${windText(h)}`}>
                <Text muted style={styles.small}>{hourFmt.format(h.time)}</Text>
                <Text style={styles.hourIcon}>{l.icon}</Text>
                <Text style={styles.hourTemp}>{deg(h.tempF)}</Text>
                <WindArrow windDeg={h.windDeg} />
                <Text style={styles.small}>{Math.round(h.windMph)}</Text>
                <Text muted style={styles.tiny}>{compassDir(h.windDeg)}</Text>
                {h.precipPct >= 20 ? <Text style={[styles.tiny, { color: tint }]}>{h.precipPct}%</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}
      <Text muted style={styles.tiny}>Wind in mph; arrows show where it blows. Blue % is the chance of rain.</Text>

      {days.map((d) => {
        const l = weatherLabel(d.code);
        return (
          <View
            key={d.date}
            style={styles.day}
            accessible
            accessibilityLabel={`${relativeDay(d.date, today)}: ${l.label}, high ${deg(d.highF)}, low ${deg(d.lowF)}, wind up to ${windText(d)}`}>
            <Text style={styles.dayName}>{relativeDay(d.date, today)}</Text>
            <Text style={styles.dayIcon}>{l.icon}</Text>
            <Text style={styles.dayTemps}>
              {deg(d.highF)} <Text muted>{deg(d.lowF)}</Text>
            </Text>
            <View style={styles.dayWind}>
              <WindArrow windDeg={d.windDeg} />
              <Text style={styles.small}>
                {Math.round(d.windMph) === 0 ? 'Calm' : `${Math.round(d.windMph)} ${compassDir(d.windDeg)}`}
                {Math.round(d.gustMph) >= Math.round(d.windMph) + 5 ? <Text muted> · gusts {Math.round(d.gustMph)}</Text> : null}
              </Text>
            </View>
          </View>
        );
      })}

      <Text muted style={styles.tiny}>
        Updated {fmtTime(now.time)}.{' '}
        <ExternalLink href={OPEN_METEO_CREDIT} style={{ color: tint }}>
          Weather data by Open-Meteo.com
        </ExternalLink>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'transparent', gap: 6 },
  line: { fontSize: 13, marginTop: 2, marginBottom: 2 },
  now: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, backgroundColor: 'transparent' },
  nowText: { backgroundColor: 'transparent' },
  nowWind: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' },
  bigIcon: { fontSize: 34 },
  temp: { fontSize: 26, fontWeight: '700' },
  windBig: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  hours: { gap: 6, paddingVertical: 6 },
  hour: {
    alignItems: 'center',
    width: 52,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 8,
    gap: 1,
    backgroundColor: 'transparent',
  },
  hourIcon: { fontSize: 18 },
  hourTemp: { fontSize: 14, fontWeight: '600' },
  day: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, backgroundColor: 'transparent' },
  dayName: { width: 88, fontSize: 13 },
  dayIcon: { width: 26, fontSize: 18, textAlign: 'center' },
  dayTemps: { width: 64, fontSize: 14, fontVariant: ['tabular-nums'] },
  dayWind: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'transparent' },
});
