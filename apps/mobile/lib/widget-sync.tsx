/**
 * Keeps the home-screen widget current. The app refreshes it whenever
 * favorites, settings or data change, and a background task refreshes it
 * about every few hours from cached data (plus a tide refresh when online).
 */
import { getSpecies } from '@costal-forager/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import BeachTide from '@/widgets/BeachTide';
import { EMPTY_BEACH_TIDE } from '@/widgets/types';
import { loadCachedBeaches, loadCachedTides, loadTides, stationFor } from './data';
import { useBeaches } from './hooks';
import { writeWidgetCharts } from './widget-chart';
import { useUser } from './store';
import { buildBeachTideEntries, effectivePick, type BeachTidePick, type WidgetInputs } from './widget-data';

type SavedState = WidgetInputs & { widget?: BeachTidePick };

export const WIDGET_TASK = 'refresh-day-quality-widget';

async function tidesWithFallback(stationId: string) {
  try {
    return await loadTides(stationId);
  } catch {
    return loadCachedTides(stationId);
  }
}

type Beaches = Awaited<ReturnType<typeof loadCachedBeaches>>;

async function publish(input: SavedState, beaches: Beaches) {
  try {
    await publishBeachTideOrThrow(input, beaches);
  } catch (e) {
    // Show the problem on the widget instead of leaving stale or setup text.
    BeachTide.updateSnapshot({ ...EMPTY_BEACH_TIDE, beach: "Couldn't update", note: String((e as Error)?.message ?? e).slice(0, 120) });
  }
}

async function publishBeachTideOrThrow(input: SavedState, beaches: Beaches) {
  const pick = effectivePick(input.widget, input.favoriteBeaches, input.favoriteSpecies, beaches);
  const beach = pick.bidn ? beaches.find((b) => b.bidn === pick.bidn) : undefined;
  let tides = null;
  if (beach) {
    const station = await stationFor(beach).catch(() => null);
    if (station) tides = await tidesWithFallback(station.id);
  }
  const entries = buildBeachTideEntries(pick, input.prefs, beach, tides);
  if (Platform.OS === 'ios') {
    BeachTide.updateTimeline(entries);
    return;
  }
  const { date, props } = entries[0];
  if (tides && pick.species && props.curve.length > 0) {
    try {
      const harvestFt = getSpecies(pick.species).marginalTideFt;
      props.charts = writeWidgetCharts('BeachTide', tides, date, harvestFt, !!(props.species || props.note));
    } catch {
      // Without a chart image the widget still shows the times.
    }
  }
  BeachTide.updateSnapshot(props);
}

// Background refresh: runs without React, so it reads the saved user state.
TaskManager.defineTask(WIDGET_TASK, async () => {
  try {
    const raw = await AsyncStorage.getItem('user:v1');
    if (!raw) return BackgroundTask.BackgroundTaskResult.Success;
    const s = JSON.parse(raw) as SavedState;
    await publish(s, await loadCachedBeaches());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Mount once near the root. Renders nothing. */
export function WidgetSync() {
  const { ready, favoriteBeaches, favoriteSpecies, prefs, widget } = useUser();
  const beaches = useBeaches();

  useEffect(() => {
    BackgroundTask.registerTaskAsync(WIDGET_TASK, { minimumInterval: 180 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !beaches.data) return;
    const input = { favoriteBeaches, favoriteSpecies, prefs, widget };
    const run = () => publish(input, beaches.data!).catch(() => {});
    // Let the screens render first; the widget can wait a moment.
    const first = setTimeout(run, 1500);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => (clearTimeout(first), sub.remove());
  }, [ready, beaches.data, favoriteBeaches, favoriteSpecies, prefs, widget]);

  return null;
}
