import {
  DOH_SAFETY_MAP,
  getSpecies,
  SPECIES,
  tideChartPng,
  toBase64,
  WDFW_RAZOR_PAGE,
  type SpeciesId,
  type TimeWindow,
} from '@costal-forager/core';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/Badges';
import { ExternalLink } from '@/components/ExternalLink';
import { Stepper } from '@/components/Stepper';
import { BeachTidePreview, PREVIEW_CHART } from '@/components/WidgetPreview';
import { Text, View, useThemeColor } from '@/components/Themed';
import { fmtFt, fmtMinutes } from '@/lib/format';
import { useBeaches, useBeachTides, useLoad } from '@/lib/hooks';
import { pushSupported, registerForPush } from '@/lib/notifications';
import { speciesForBeach } from '@/lib/species';
import { useUser } from '@/lib/store';
import { loadForecast } from '@/lib/tides';
import { buildBeachTideEntries, chartWindow, effectivePick } from '@/lib/widget-data';
import { WIDGET_COLORS } from '@/widgets/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (m: number) => ((m % 1440) + 1440) % 1440;

export default function SettingsScreen() {
  const { prefs, setPrefs, favoriteSpecies, toggleSpecies, reset, account, sync, syncError, notify, setNotify, favoriteBeaches } =
    useUser();
  const tint = useThemeColor('tint');
  const [pushError, setPushError] = useState<string | null>(null);

  const enableAlerts = async (on: boolean) => {
    setPushError(null);
    if (!on) return setNotify((n) => ({ ...n, enabled: false }));
    const r = await registerForPush();
    if (!r.ok) return setPushError(r.reason);
    setNotify((n) => ({ ...n, enabled: true }));
  };
  const syncText =
    sync === 'syncing'
      ? 'Backing up…'
      : sync === 'error'
        ? `Backup failed: ${syncError}`
        : sync === 'local'
          ? 'Not backed up yet; this happens once the app is online.'
          : 'Backed up.';
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
        <Text style={styles.h2}>Your data</Text>
        <Text muted style={styles.help}>
          Favorites and settings are saved on this device and backed up to an anonymous account. No sign-in needed.
        </Text>
        <Text muted style={styles.help}>
          {syncText}
        </Text>
      </View>

      {pushSupported && (
        <View card>
          <Text style={styles.h2}>Alerts</Text>
          <Text muted style={styles.help}>
            A morning notification such as "Today is a good day for Oysters at Potlatch!" for your favorite beaches
            and species.
          </Text>
          {!account ? (
            <Text muted style={styles.help}>
              Alerts need a connection the first time. Check you're online and reopen the app.
            </Text>
          ) : (
            <>
              <View style={styles.chips}>
                <Chip label="Off" selected={!notify.enabled} onPress={() => enableAlerts(false)} />
                <Chip label="On" selected={notify.enabled} onPress={() => enableAlerts(true)} />
              </View>
              {pushError && <Text style={styles.error}>{pushError}</Text>}
              {notify.enabled && (
                <>
                  {favoriteBeaches.length === 0 && (
                    <Text muted style={styles.help}>
                      Star a beach first; alerts only cover your favorite beaches.
                    </Text>
                  )}
                  <Stepper
                    label="Send at"
                    hint="Pacific time"
                    value={fmtMinutes(notify.localMinutes)}
                    onMinus={() => setNotify((n) => ({ ...n, localMinutes: clamp(n.localMinutes - 30, 240, 1320) }))}
                    onPlus={() => setNotify((n) => ({ ...n, localMinutes: clamp(n.localMinutes + 30, 240, 1320) }))}
                  />
                  <Text style={styles.h3}>Only for days rated</Text>
                  <View style={styles.chips}>
                    {(['great', 'good', 'marginal'] as const).map((r) => (
                      <Chip
                        key={r}
                        label={r === 'great' ? 'Great' : r === 'good' ? 'Good or better' : 'Marginal or better'}
                        selected={notify.minRating === r}
                        onPress={() => setNotify((n) => ({ ...n, minRating: r }))}
                      />
                    ))}
                  </View>
                  <Text style={styles.h3}>Evening before</Text>
                  <View style={styles.chips}>
                    <Chip
                      label="Also tell me the night before"
                      selected={notify.eveningBefore}
                      onPress={() => setNotify((n) => ({ ...n, eveningBefore: !n.eveningBefore }))}
                    />
                  </View>
                </>
              )}
            </>
          )}
        </View>
      )}

      {Platform.OS !== 'web' && <WidgetSettings />}

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

/** Picks the beach and species for the "Tides" home-screen widget. */
function WidgetSettings() {
  const { widget, setWidget, favoriteBeaches, favoriteSpecies, prefs } = useUser();
  const beaches = useBeaches();
  const byId = new Map((beaches.data ?? []).map((b) => [b.bidn, b]));
  // What the widget shows now: the pick, or the first favorite until one is picked.
  const shown = useMemo(
    () => effectivePick(widget, favoriteBeaches, favoriteSpecies, beaches.data ?? []),
    [widget, favoriteBeaches, favoriteSpecies, beaches.data],
  );
  const ids = shown.bidn && !favoriteBeaches.includes(shown.bidn) ? [shown.bidn, ...favoriteBeaches] : favoriteBeaches;
  const choices = ids.map((id) => byId.get(id)).filter((b) => !!b);
  const beach = shown.bidn ? byId.get(shown.bidn) : undefined;
  const species = beach ? speciesForBeach(beach) : [];
  const beachTides = useBeachTides(beach);
  // A tide station picked from the tide map, TideWidget style.
  const stationId = shown.station?.id ?? null;
  const stationTides = useLoad(() => (stationId ? loadForecast(stationId) : Promise.resolve(null)), [stationId]);
  const tides = {
    loading: stationId ? stationTides.loading : beachTides.loading,
    data: stationId ? stationTides.data : (beachTides.data?.tides ?? null),
  };
  // The same content the home-screen widget gets right now.
  const preview = useMemo(
    () => buildBeachTideEntries(shown, prefs, beach, tides.data)[0].props,
    [shown, prefs, beach, tides.data], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // The chart, drawn by the same code that draws the Android widget's.
  const chartUri = useMemo(() => {
    const t = tides.data;
    if (!t || (!shown.species && !shown.station)) return null;
    const at = new Date();
    const png = tideChartPng(t, {
      width: PREVIEW_CHART.w * 2,
      height: PREVIEW_CHART.h * 2,
      ...chartWindow(at),
      now: at,
      scale: 2,
      harvestFt: shown.species ? getSpecies(shown.species).marginalTideFt : null,
      colors: { harvest: WIDGET_COLORS.harvest },
    });
    return png ? `data:image/png;base64,${toBase64(png)}` : null;
  }, [tides.data, shown.species, shown.station]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickBeach = (bidn: string) => {
    const b = byId.get(bidn);
    const here = b ? speciesForBeach(b) : [];
    // Keep the species if it lives here too, else start with a favorite one.
    const keep = shown.species && here.includes(shown.species) ? shown.species : null;
    setWidget({ bidn, species: keep ?? here.find((id) => favoriteSpecies.includes(id)) ?? here[0] ?? null });
  };

  return (
    <View card>
      <Text style={styles.h2}>Home-screen widget</Text>
      <Text muted style={styles.help}>
        Add the "Tides" widget (3x2) to your home screen. It shows the next high and low tide and a 24-hour tide chart
        for this beach: red dots are highs, blue dots are lows, the dashed line is now, and green shading is water low
        enough for the species. The dot in the corner is the day's rating with your hours, days and tide settings. It
        fits itself to any size from 1x1 up. To show a plain tide station instead, open it from the Tides map and tap
        "Show this station on my home-screen widget".
      </Text>
      {shown.station && (
        <>
          <Text style={styles.h3}>Tide station</Text>
          <View style={styles.chips}>
            <Chip label={shown.station.name} selected onPress={() => {}} />
          </View>
          <Text muted style={styles.help}>
            Pick a beach below to show a beach and species again.
          </Text>
        </>
      )}
      <Text style={styles.h3}>Beach</Text>
      {choices.length === 0 ? (
        <Text muted style={styles.help}>
          {beaches.loading ? 'Loading beaches…' : 'Star a beach first, or open a beach and tap "Show on widget".'}
        </Text>
      ) : (
        <View style={styles.chips}>
          {choices.map((b) => (
            <Chip key={b.bidn} label={b.name} selected={!shown.station && shown.bidn === b.bidn} onPress={() => pickBeach(b.bidn)} />
          ))}
        </View>
      )}
      {beach && (
        <>
          <Text style={styles.h3}>Species</Text>
          <View style={styles.chips}>
            {species.map((id) => (
              <Chip
                key={id}
                label={getSpecies(id).plural}
                selected={shown.species === id}
                onPress={() => setWidget({ bidn: beach.bidn, species: id })}
              />
            ))}
          </View>
        </>
      )}
      {shown.auto && beach && (
        <Text muted style={styles.help}>
          Showing your first favorite beach until you pick one.
        </Text>
      )}
      <Text style={styles.h3}>Preview</Text>
      <BeachTidePreview
        p={tides.loading && !tides.data && beach ? { ...preview, highTime: '', lowTime: '', curve: [], note: 'Loading tides…' } : preview}
        chartUri={tides.loading && !tides.data ? null : chartUri}
      />
      <Text muted style={[styles.help, { textAlign: 'center' }]}>
        Tap the widget on your home screen to open this beach in the app.
      </Text>
    </View>
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
  error: { color: '#c0392b', fontSize: 13, marginTop: 4 },
});
