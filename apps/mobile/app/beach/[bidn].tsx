import {
  addDays,
  DOH_HOTLINE,
  DOH_SAFETY_MAP,
  getSpecies,
  localDateKey,
  nextIdealDays,
  scoreDay,
  WDFW_BEACH_PAGE,
  WDFW_RAZOR_PAGE,
  type SpeciesId,
} from '@costal-forager/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Chip, StatusBadge } from '@/components/Badges';
import { DayScoreLine } from '@/components/DayScoreLine';
import { ExternalLink } from '@/components/ExternalLink';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { toContext } from '@/lib/data';
import { fmtDay, relativeDay } from '@/lib/format';
import { useBeaches, useBeachTides } from '@/lib/hooks';
import { speciesForBeach } from '@/lib/species';
import { useUser } from '@/lib/store';

export default function BeachScreen() {
  const { bidn } = useLocalSearchParams<{ bidn: string }>();
  const beaches = useBeaches();
  const beach = beaches.data?.find((b) => b.bidn === bidn);
  const tides = useBeachTides(beach);
  const { prefs, favoriteSpecies } = useUser();
  const tint = useThemeColor('tint');
  const today = localDateKey(new Date());

  const species = useMemo(() => (beach ? speciesForBeach(beach) : []), [beach]);
  const [selected, setSelected] = useState<SpeciesId | null>(null);
  useEffect(() => {
    if (!selected && species.length) setSelected(species.find((s) => favoriteSpecies.includes(s)) ?? species[0]);
  }, [species, selected, favoriteSpecies]);

  const ctx = beach ? toContext(beach) : null;

  const summary = useMemo(() => {
    if (!ctx || !tides.data) return [];
    return species.map((id) => ({
      today: scoreDay(id, ctx, today, tides.data!.tides, prefs, today),
      next: nextIdealDays(id, ctx, tides.data!.tides, prefs, { fromKey: today })[0] ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tides.data, beach, prefs, today, species]);

  const calendar = useMemo(() => {
    if (!ctx || !tides.data || !selected) return [];
    return Array.from({ length: 14 }, (_, i) =>
      scoreDay(selected, ctx, addDays(today, i), tides.data!.tides, prefs, today),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tides.data, beach, prefs, today, selected]);

  if (!beach) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Beach' }} />
        {beaches.loading ? <ActivityIndicator /> : <Text>Beach {bidn} isn't in the DOH list.</Text>}
      </View>
    );
  }

  const isRazor = selected === 'razor_clam';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: beach.name }} />

      <View card>
        <View style={styles.head}>
          <View style={styles.title}>
            <FavoriteButton bidn={beach.bidn} name={beach.name} />
            <Text style={styles.h1}>{beach.name}</Text>
          </View>
          <StatusBadge status={beach.status} />
        </View>
        <Text muted>{[beach.waterbody, beach.county && `${beach.county} County`].filter(Boolean).join(' · ')}</Text>
        {beach.seasonText ? <Text style={styles.para}>{beach.seasonText}</Text> : null}
        {beach.closedForText && beach.closedForText !== 'None' ? (
          <Text style={styles.para}>Closed for: {beach.closedForText}</Text>
        ) : null}
        {beach.emergency ? <Text style={[styles.para, styles.warn]}>{beach.emergency}</Text> : null}
        {beach.message ? <Text style={styles.para}>{beach.message}</Text> : null}
        {beach.vibrio ? <Text style={styles.para}>Vibrio advisory: cook shellfish thoroughly.</Text> : null}
        {beach.advisory ? <Text muted style={styles.para}>{beach.advisory}</Text> : null}
        <Text muted style={styles.small}>
          DOH status as of {beach.updatedAt ? fmtDay(localDateKey(new Date(beach.updatedAt))) : 'unknown'}. Hotline{' '}
          {DOH_HOTLINE}.
        </Text>
        <ExternalLink href={DOH_SAFETY_MAP} style={[styles.link, { color: tint }]}>
          DOH safety map
        </ExternalLink>
        <ExternalLink href={WDFW_BEACH_PAGE(beach.bidn)} style={[styles.link, { color: tint }]}>
          WDFW beach page (access, map, harvest profile)
        </ExternalLink>
      </View>

      <View card>
        <Text style={styles.h2}>Species here</Text>
        {tides.data && (
          <Text muted style={styles.small}>
            Tides from NOAA {tides.data.station.name} ({tides.data.km.toFixed(0)} km away)
          </Text>
        )}
        {tides.loading && !tides.data && <ActivityIndicator style={{ marginVertical: 8 }} />}
        {tides.error && <Text muted>Tides unavailable: {tides.error}</Text>}
        {summary.map(({ today: t, next }) => (
          <View key={t.speciesId} style={styles.speciesBlock}>
            <DayScoreLine score={t} title={getSpecies(t.speciesId).plural} showSpecies={false} />
            <Text muted style={styles.next}>
              {next ? `Next good day: ${relativeDay(next.date, today)}` : 'No good day in the next year with your settings'}
            </Text>
          </View>
        ))}
      </View>

      <View card>
        <Text style={styles.h2}>Next 14 days</Text>
        <View style={styles.chips}>
          {species.map((id) => (
            <Chip key={id} label={getSpecies(id).plural} selected={selected === id} onPress={() => setSelected(id)} />
          ))}
        </View>
        {isRazor && (
          <ExternalLink href={WDFW_RAZOR_PAGE} style={[styles.link, { color: tint }]}>
            Razor clam digs are announced by WDFW about a week ahead. Check the schedule.
          </ExternalLink>
        )}
        {calendar.map((s) => (
          <DayScoreLine key={s.date} score={s} title={relativeDay(s.date, today)} showSpecies={false} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, backgroundColor: 'transparent' },
  h1: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  h2: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  para: { fontSize: 14, marginTop: 8 },
  warn: { fontWeight: '700' },
  small: { fontSize: 12, marginTop: 8 },
  link: { fontSize: 14, marginTop: 8 },
  speciesBlock: { backgroundColor: 'transparent' },
  next: { fontSize: 12, marginLeft: 4, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, backgroundColor: 'transparent' },
});
