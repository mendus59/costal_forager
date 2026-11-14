import { Image, StyleSheet, Text, View } from 'react-native';

import { WIDGET_COLORS, type BeachTideProps } from '@/widgets/types';

/** The preview charts' sizes in dp: the 3x2 widget's and the 3x1 widget's. */
export const PREVIEW_CHART = { w: 292, h: 100 };
export const PREVIEW_INLINE_CHART = { w: 140, h: 58 };

/**
 * The water height now, in a small tag at the top of the chart just right of
 * the now line (3 hours into the 24-hour chart), as the Android widget shows it.
 */
function NowTag({ p }: { p: BeachTideProps }) {
  if (!p.nowFt) return null;
  return (
    <View style={[styles.nowTag, { backgroundColor: p.bg }]} accessible accessibilityLabel={`Tide now ${p.nowFt}`}>
      <Text style={[styles.nowText, { color: p.fg }]} numberOfLines={1}>
        {p.nowFt}
      </Text>
    </View>
  );
}

/** The 3x1 widget: beach and times on the left, a small chart on the right. */
export function BeachTideInlinePreview({ p, chartUri }: { p: BeachTideProps; chartUri?: string | null }) {
  const tides = p.highTime || p.lowTime;
  return (
    <View
      style={[styles.inlineCard, { backgroundColor: p.bg }]}
      accessible
      accessibilityLabel={`3 by 1 widget preview: ${[p.beach, p.status, p.nowFt && `now ${p.nowFt}`, tides ? `next high ${p.highTime}, next low ${p.lowTime}` : p.note]
        .filter(Boolean)
        .join(', ')}`}>
      <View style={styles.inlineText}>
        <View style={styles.inlineHead}>
          {p.status ? <View style={[styles.inlineDot, { backgroundColor: p.dot }]} /> : null}
          <Text style={[styles.inlineBeach, { color: p.fg }]} numberOfLines={1}>
            {p.beach}
          </Text>
        </View>
        {tides ? (
          <>
            <Text numberOfLines={1}>
              <Text style={{ color: WIDGET_COLORS.high, fontSize: 11 }}>▲ </Text>
              <Text style={[styles.inlineTime, { color: p.fg }]}>{p.highTime} </Text>
              <Text style={{ color: p.muted, fontSize: 10 }}>{p.highFt}</Text>
            </Text>
            <Text numberOfLines={1}>
              <Text style={{ color: WIDGET_COLORS.lowText, fontSize: 11 }}>▼ </Text>
              <Text style={[styles.inlineTime, { color: p.fg }]}>{p.lowTime} </Text>
              <Text style={{ color: p.muted, fontSize: 10 }}>{p.lowFt}</Text>
            </Text>
          </>
        ) : (
          <Text style={[styles.sub, { color: p.muted }]} numberOfLines={2}>
            {[p.species, p.note].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      {chartUri && tides ? (
        <View>
          <Image
            source={{ uri: chartUri }}
            resizeMode="contain"
            style={{ width: PREVIEW_INLINE_CHART.w, height: PREVIEW_INLINE_CHART.h }}
            accessibilityLabel="Tide chart, next 24 hours"
          />
          <NowTag p={p} />
        </View>
      ) : null}
    </View>
  );
}

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
        <View>
          <Image
            source={{ uri: chartUri }}
            resizeMode="contain"
            style={styles.chart}
            accessibilityLabel="Tide chart, next 24 hours"
          />
          <NowTag p={p} />
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
  inlineCard: {
    width: '100%',
    maxWidth: 320,
    height: 74,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineText: { width: 148, marginRight: 6 },
  inlineHead: { flexDirection: 'row', alignItems: 'center' },
  inlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  inlineBeach: { fontSize: 12, fontWeight: 'bold' },
  inlineTime: { fontSize: 14, fontWeight: 'bold' },
  dot: { position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 5 },
  beach: { fontSize: 14, fontWeight: 'bold', marginRight: 18 },
  sub: { fontSize: 11 },
  tides: { flexDirection: 'row', marginVertical: 4 },
  tide: { marginRight: 18 },
  label: { fontSize: 10 },
  time: { fontSize: 15, fontWeight: 'bold' },
  chart: { width: '100%', height: PREVIEW_CHART.h, marginTop: 2 },
  nowTag: { position: 'absolute', top: 0, left: '12.5%', marginLeft: 4, borderRadius: 4, paddingHorizontal: 3 },
  nowText: { fontSize: 10, fontWeight: 'bold' },
});
