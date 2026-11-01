import { addDays, bestOfDay, localDateKey, nextIdealDays, type DayScore, type SpeciesId } from '@costal-forager/core';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { RatingBadge } from '@/components/Badges';
import { DayScoreLine } from '@/components/DayScoreLine';
import { Text, View, useThemeColor } from '@/components/Themed';
import { toContext, type Beach } from '@/lib/data';
import { fmtDay, relativeDay } from '@/lib/format';
import { useBeaches, useBeachTides } from '@/lib/hooks';
import { speciesForBeach } from '@/lib/species';
import { useUser } from '@/lib/store';

export default function TodayScreen() {
  const { favoriteBeaches, ready } = useUser();
  const beaches = useBeaches();
  const tint = useThemeColor('tint');
  const today = localDateKey(new Date());
  const favorites = useMemo(
    () => (beaches.data ?? []).filter((b) => favoriteBeaches.includes(b.bidn)),
    [beaches.data, favoriteBeaches],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={beaches.loading} onRefresh={beaches.reload} />}>
      <Text style={styles.h1}>{fmtDay(today)}</Text>
      <Text muted style={styles.sub}>
        Ratings combine DOH status, the WDFW season, the low tide, and your hours.
      </Text>

      {beaches.error && (
        <View card style={styles.card}>
          <Text>Couldn't load beach status: {beaches.error}</Text>
          <Pressable onPress={beaches.reload}>
            <Text style={{ color: tint, marginTop: 6 }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!beaches.data && beaches.loading && <ActivityIndicator style={{ marginTop: 24 }} />}

      {beaches.data && ready && favorites.length === 0 && (
        <View card style={styles.card}>
          <Text style={styles.h2}>Pick your beaches</Text>
          <Text muted style={{ marginTop: 4 }}>
            Star beaches on the Beaches tab to see today's conditions and the next good day here.
          </Text>
          <Link href="/beaches" style={[styles.link, { color: tint }]}>
            Browse beaches
          </Link>
        </View>
      )}

      {favorites.map((b) => (
        <FavoriteCard key={b.bidn} beach={b} today={today} />
      ))}

      <Text muted style={styles.footer}>
        Guidance only. Always check the DOH shellfish safety map or call 1-800-562-5632 before harvesting.
      </Text>
    </ScrollView>
  );
}

function FavoriteCard({ beach, today }: { beach: Beach; today: string }) {
  const { favoriteSpecies, prefs } = useUser();
  const tides = useBeachTides(beach);
  const ctx = toContext(beach);
  const species = speciesForBeach(beach, favoriteSpecies);

  const { best, next } = useMemo(() => {
    if (!ctx || !tides.data) return { best: null, next: [] as DayScore[] };
    const t = tides.data.tides;
    const best = bestOfDay(species, ctx, today, t, prefs);
    // The next three good dates after today, each with its best species.
    const byDate = new Map<string, DayScore>();
    for (const id of species as SpeciesId[]) {
      for (const s of nextIdealDays(id, ctx, t, prefs, { fromKey: addDays(today, 1), todayKey: today, days: 120, limit: 3 })) {
        const prev = byDate.get(s.date);
        if (!prev || s.score > prev.score) byDate.set(s.date, s);
      }
    }
    const next = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    return { best, next };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tides.data, beach, species.join(), prefs, today]);

  return (
    <Link href={{ pathname: '/beach/[bidn]', params: { bidn: beach.bidn } }} asChild>
      <Pressable>
        <View card style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.h2}>{beach.name}</Text>
            {best && <RatingBadge rating={best.rating} large />}
          </View>
          {tides.loading && <ActivityIndicator style={{ marginVertical: 8 }} />}
          {tides.error && <Text muted>Tides unavailable: {tides.error}</Text>}
          {species.length === 0 && <Text muted>None of your species live on this kind of beach.</Text>}
          {best && <DayScoreLine score={best} title="Today" />}
          {next.length > 0 && (
            <>
              <Text muted style={styles.label}>
                Next good days
              </Text>
              {next.map((s) => (
                <DayScoreLine key={`${s.speciesId}-${s.date}`} score={s} title={relativeDay(s.date, today)} hideCautions />
              ))}
            </>
          )}
          {tides.data && next.length === 0 && species.length > 0 && (
            <Text muted style={styles.label}>
              No good days in the next 120 days with your settings.
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  sub: { fontSize: 14, marginBottom: 4 },
  card: { gap: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent', gap: 8 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  link: { marginTop: 10, fontWeight: '600' },
  footer: { fontSize: 12, marginTop: 12, textAlign: 'center' },
});
