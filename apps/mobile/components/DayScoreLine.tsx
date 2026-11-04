import { getSpecies, type DayScore } from '@costal-forager/core';
import { StyleSheet, View } from 'react-native';

import { fmtFt, fmtTime } from '@/lib/format';
import { RatingBadge } from './Badges';
import { Text } from './Themed';

/** One rated day: badge, species, and the low tide that earns the rating. */
export function DayScoreLine({
  score,
  title,
  showSpecies = true,
  hideCautions = false,
}: {
  score: DayScore;
  title?: string;
  showSpecies?: boolean;
  hideCautions?: boolean;
}) {
  const sp = getSpecies(score.speciesId);
  const low = score.best?.low;
  let detail: string;
  if (!score.gate.legal) detail = score.gate.reason;
  else if (!low) detail = 'No low tide this day';
  else {
    detail = `Low ${fmtFt(low.heightFt)} at ${fmtTime(low.time)}`;
    if (score.best?.usable && score.rating !== 'poor') {
      detail += ` · go ${fmtTime(score.best.usable.start)}–${fmtTime(score.best.usable.end)}`;
    }
  }
  const cautions = score.gate.legal && !hideCautions ? score.gate.cautions : [];
  return (
    <View style={styles.row}>
      <RatingBadge rating={score.rating} />
      <View style={styles.body}>
        <Text style={styles.title}>
          {title ?? ''}
          {title && showSpecies ? ' · ' : ''}
          {showSpecies ? sp.plural : ''}
        </Text>
        <Text muted style={styles.detail}>
          {detail}
        </Text>
        {cautions.length > 0 && (
          <Text muted style={styles.caution}>
            {cautions.join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10 },
  body: { flex: 1, backgroundColor: 'transparent' },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
  caution: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },
});
