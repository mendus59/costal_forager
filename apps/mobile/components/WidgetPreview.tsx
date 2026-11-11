import { Image, StyleSheet, Text, View } from 'react-native';

import { WIDGET_COLORS, type BeachTideProps } from '@/widgets/types';

/** The preview chart's size in dp. */
export const PREVIEW_CHART = { w: 292, h: 60 };

/**
 * An in-app picture of the home-screen widget, drawn from the same props the
 * real widget gets and laid out like the Android 3x2 widget. `chartUri` is
 * the tide chart image, drawn by the same code as the widget's.
 */
export function BeachTidePreview({ p, chartUri }: { p: BeachTideProps; chartUri?: string | null }) {
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
            <Text style={[styles.label, { color: p.muted }]}>
              <Text style={{ color: WIDGET_COLORS.high }}>▲</Text>
              {`  High  ${p.highFt}`}
            </Text>
            <Text style={[styles.time, { color: p.fg }]}>{p.highTime}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: p.muted }]}>
              <Text style={{ color: WIDGET_COLORS.lowText }}>▼</Text>
              {`  Low  ${p.lowFt}`}
            </Text>
            <Text style={[styles.time, { color: p.fg }]}>{p.lowTime}</Text>
          </View>
        </View>
      ) : null}
      {chartUri && p.curve.length > 0 ? (
        <Image
          source={{ uri: chartUri }}
          resizeMode="stretch"
          style={styles.chart}
          accessibilityLabel="Tide chart, next 24 hours"
        />
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
  tide: { marginRight: 18 },
  label: { fontSize: 10 },
  time: { fontSize: 15, fontWeight: 'bold' },
  chart: { width: '100%', height: PREVIEW_CHART.h, marginTop: 2 },
});
