import { gate, localDateKey, type SpeciesId } from '@costal-forager/core';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Chip, StatusBadge } from '@/components/Badges';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { toContext, type Beach } from '@/lib/data';
import { useBeaches } from '@/lib/hooks';
import { speciesName } from '@/lib/species';
import { useUser } from '@/lib/store';

const STATUS_RANK: Record<string, number> = { open: 0, unclassified: 1, conditional: 2, unknown: 3, closed: 4 };

export default function BeachesScreen() {
  const beaches = useBeaches();
  const { favoriteBeaches, favoriteSpecies } = useUser();
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState<SpeciesId | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const text = useThemeColor('text');
  const border = useThemeColor('border');
  const muted = useThemeColor('muted');
  const today = localDateKey(new Date());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = beaches.data ?? [];
    if (favoritesOnly) list = list.filter((b) => favoriteBeaches.includes(b.bidn));
    if (q) {
      list = list.filter((b) =>
        [b.name, b.county, b.waterbody, b.growingArea].some((f) => f?.toLowerCase().includes(q)),
      );
    }
    if (species) {
      // Recommended for a species: legal to harvest today, open beaches first.
      list = list.filter((b) => {
        const ctx = toContext(b);
        return ctx ? gate(species, ctx, today, today).legal : false;
      });
      list = [...list].sort(
        (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name),
      );
    }
    return list;
  }, [beaches.data, query, species, favoritesOnly, favoriteBeaches, today]);

  return (
    <View style={styles.page}>
      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by beach, county, or water body"
          placeholderTextColor={muted}
          accessibilityLabel="Search beaches"
          style={[styles.search, { color: text, borderColor: border }]}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="★ Favorites" selected={favoritesOnly} onPress={() => setFavoritesOnly((v) => !v)} />
          {favoriteSpecies.map((id) => (
            <Chip
              key={id}
              label={speciesName(id)}
              selected={species === id}
              onPress={() => setSpecies((s) => (s === id ? null : id))}
            />
          ))}
        </ScrollView>
        <Text muted style={styles.count}>
          {species
            ? `${rows.length} beaches open for ${speciesName(species).toLowerCase()} today`
            : `${rows.length} beaches monitored by DOH`}
        </Text>
      </View>

      {beaches.loading && !beaches.data ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : beaches.error && !beaches.data ? (
        <Text style={{ padding: 16 }}>Couldn't load beaches: {beaches.error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.bidn}
          renderItem={({ item }) => <BeachRow beach={item} />}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: border }]} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          onRefresh={beaches.reload}
          refreshing={beaches.loading}
          initialNumToRender={20}
        />
      )}
    </View>
  );
}

function BeachRow({ beach }: { beach: Beach }) {
  const where = [beach.waterbody, beach.county && `${beach.county} County`].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <FavoriteButton bidn={beach.bidn} name={beach.name} size={20} />
      <Link href={{ pathname: '/beach/[bidn]', params: { bidn: beach.bidn } }} asChild>
        <Pressable style={styles.rowMain} accessibilityRole="link">
          <Text style={styles.name}>{beach.name}</Text>
          <Text muted style={styles.where}>
            {where}
          </Text>
          <View style={styles.badges}>
            <StatusBadge status={beach.status} />
            {beach.closedForText && beach.closedForText !== 'None' && beach.status !== 'closed' ? (
              <Text muted style={styles.closedFor}>
                Closed for {beach.closedForText.toLowerCase()}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 12 },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chips: { paddingVertical: 10 },
  count: { fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  rowMain: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  where: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, backgroundColor: 'transparent' },
  closedFor: { fontSize: 12 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
