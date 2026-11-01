import { DOH_SAFETY_MAP, getSpecies, SPECIES, WDFW_RAZOR_PAGE, type SpeciesId, type TimeWindow } from '@costal-forager/core';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/Badges';
import { ExternalLink } from '@/components/ExternalLink';
import { Stepper } from '@/components/Stepper';
import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtFt, fmtMinutes } from '@/lib/format';
import { useUser } from '@/lib/store';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (m: number) => ((m % 1440) + 1440) % 1440;

export default function SettingsScreen() {
  const { prefs, setPrefs, favoriteSpecies, toggleSpecies, reset } = useUser();
  const tint = useThemeColor('tint');
  const w = prefs.window;

  const setWindow = (window: TimeWindow) => setPrefs((p) => ({ ...p, window }));
  const days = prefs.daysOfWeek;
  const toggleDay = (d: number) =>
    setPrefs((p) => {
      const cur = p.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort();
      return { ...p, daysOfWeek: next.length === 7 || next.length === 0 ? undefined : next };
    });

  const tideFor = (id: SpeciesId) => prefs.tideOverrides?.[id]?.idealTideFt ?? getSpecies(id).idealTideFt;
  const setTide = (id: SpeciesId, delta: number) =>
    setPrefs((p) => {
      const sp = getSpecies(id);
      const ideal = clamp(Math.round((tideFor(id) + delta) * 10) / 10, -4, 4);
      // Keep the default gap between ideal and marginal heights.
      const marginal = ideal + (sp.marginalTideFt - sp.idealTideFt);
      return { ...p, tideOverrides: { ...p.tideOverrides, [id]: { idealTideFt: ideal, marginalTideFt: marginal } } };
    });
  const clearTide = (id: SpeciesId) =>
    setPrefs((p) => {
      const next = { ...p.tideOverrides };
      delete next[id];
      return { ...p, tideOverrides: next };
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View card>
        <Text style={styles.h2}>When you like to go</Text>
        <Text muted style={styles.help}>
          A day only rates well if the low tide falls inside these hours.
        </Text>
        <View style={styles.chips}>
          <Chip
            label="Daylight"
            selected={w.kind === 'daylight'}
            onPress={() => setWindow({ kind: 'daylight', paddingMinutes: 60 })}
          />
          <Chip
            label="Custom hours"
            selected={w.kind === 'custom'}
            onPress={() => setWindow({ kind: 'custom', startMinutes: 10 * 60, endMinutes: 14 * 60 })}
          />
        </View>
        {w.kind === 'daylight' ? (
          <Stepper
            label="Extra time around daylight"
            hint="Before sunrise and after sunset"
            value={`${w.paddingMinutes} min`}
            onMinus={() => setWindow({ ...w, paddingMinutes: clamp(w.paddingMinutes - 15, 0, 120) })}
            onPlus={() => setWindow({ ...w, paddingMinutes: clamp(w.paddingMinutes + 15, 0, 120) })}
          />
        ) : (
          <>
            <Stepper
              label="From"
              value={fmtMinutes(w.startMinutes)}
              onMinus={() => setWindow({ ...w, startMinutes: wrap(w.startMinutes - 30) })}
              onPlus={() => setWindow({ ...w, startMinutes: wrap(w.startMinutes + 30) })}
            />
            <Stepper
              label="Until"
              hint={w.endMinutes <= w.startMinutes ? 'Ends the next morning' : undefined}
              value={fmtMinutes(w.endMinutes)}
              onMinus={() => setWindow({ ...w, endMinutes: wrap(w.endMinutes - 30) })}
              onPlus={() => setWindow({ ...w, endMinutes: wrap(w.endMinutes + 30) })}
            />
          </>
        )}
        <Text style={[styles.h3]}>Days</Text>
        <View style={styles.chips}>
          {DAYS.map((d, i) => (
            <Chip key={d} label={d} selected={!days || days.includes(i)} onPress={() => toggleDay(i)} />
          ))}
        </View>
      </View>

      <View card>
        <Text style={styles.h2}>Your species</Text>
        <Text muted style={styles.help}>
          Shown on Today and used for notifications.
        </Text>
        <View style={styles.chips}>
          {SPECIES.map((s) => (
            <Chip key={s.id} label={s.plural} selected={favoriteSpecies.includes(s.id)} onPress={() => toggleSpecies(s.id)} />
          ))}
        </View>
      </View>

      <View card>
        <Text style={styles.h2}>Ideal low tide</Text>
        <Text muted style={styles.help}>
          Feet above or below the average lowest low (MLLW). Lower is better for most species.
        </Text>
        {favoriteSpecies.map((id) => {
          const sp = getSpecies(id);
          const changed = prefs.tideOverrides?.[id]?.idealTideFt !== undefined;
          return (
            <View key={id}>
              <Stepper
                label={sp.plural}
                hint={
                  changed
                    ? `Default ${fmtFt(sp.idealTideFt)}`
                    : sp.tideSource === 'wdfw'
                      ? 'WDFW guidance'
                      : 'Estimate; adjust to taste'
                }
                value={fmtFt(tideFor(id))}
                onMinus={() => setTide(id, -0.5)}
                onPlus={() => setTide(id, 0.5)}
              />
              {changed && (
                <Pressable onPress={() => clearTide(id)} accessibilityRole="button">
                  <Text style={{ color: tint, fontSize: 13, marginBottom: 4 }}>Reset {sp.plural.toLowerCase()}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View card>
        <Text style={styles.h2}>Before you go</Text>
        <Text muted style={styles.help}>
          This app is guidance, not an official notice. Status comes from the Washington State Department of Health
          and seasons from WDFW. Tides are NOAA predictions; weather can change them.
        </Text>
        <ExternalLink href={DOH_SAFETY_MAP} style={[styles.link, { color: tint }]}>
          DOH shellfish safety map
        </ExternalLink>
        <ExternalLink href={WDFW_RAZOR_PAGE} style={[styles.link, { color: tint }]}>
          WDFW razor clam digs
        </ExternalLink>
        <ExternalLink href="https://fishhunt.dfw.wa.gov/" style={[styles.link, { color: tint }]}>
          Buy a shellfish license
        </ExternalLink>
      </View>

      <Pressable onPress={reset} accessibilityRole="button" style={styles.reset}>
        <Text muted>Reset all settings and favorites</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  h2: { fontSize: 18, fontWeight: '700' },
  h3: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  help: { fontSize: 13, marginTop: 4, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'transparent', marginTop: 4 },
  link: { fontSize: 15, marginTop: 8 },
  reset: { alignItems: 'center', padding: 12 },
});
