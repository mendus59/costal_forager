/**
 * Syncs favorites, scoring preferences and alert settings with the signed-in
 * user's Supabase rows (profiles, favorite_beaches, favorite_species).
 */
import { prefsFromProfile, SPECIES, type Rating, type ScoringPrefs, type SpeciesId } from '@costal-forager/core';

import { supabase } from './supabase';

export interface NotifySettings {
  enabled: boolean;
  /** Lowest rating that triggers an alert. */
  minRating: Exclude<Rating, 'closed' | 'poor'>;
  /** Local (Pacific) minutes after midnight to send the morning alert. */
  localMinutes: number;
  /** Also send a heads-up the evening before. */
  eveningBefore: boolean;
}

export interface SyncedState {
  favoriteBeaches: string[];
  favoriteSpecies: SpeciesId[];
  prefs: ScoringPrefs;
  notify: NotifySettings;
}

export const DEFAULT_NOTIFY: NotifySettings = { enabled: false, minRating: 'good', localMinutes: 420, eveningBefore: false };

const SPECIES_IDS = new Set<string>(SPECIES.map((s) => s.id));

interface ProfileRow {
  time_window: ScoringPrefs['window'];
  days_of_week: number[] | null;
  tide_overrides: ScoringPrefs['tideOverrides'] | null;
  min_overlap_minutes: number | null;
  notify_enabled: boolean;
  notify_min_rating: string;
  notify_local_minutes: number;
  notify_evening_before: boolean;
  updated_at: string;
}

export interface RemoteState extends SyncedState {
  /** True once the user has saved anything, so remote settings win over the device's. */
  customized: boolean;
}

/** Reads the user's rows. Returns null when the profile row does not exist yet. */
export async function pullRemote(userId: string): Promise<RemoteState | null> {
  const [profile, beaches, species] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle<ProfileRow & { created_at: string }>(),
    supabase.from('favorite_beaches').select('bidn').eq('user_id', userId),
    supabase.from('favorite_species').select('species_id').eq('user_id', userId),
  ]);
  for (const r of [profile, beaches, species]) if (r.error) throw r.error;
  const p = profile.data;
  if (!p) return null;
  const minRating = (['great', 'good', 'marginal'] as const).find((r) => r === p.notify_min_rating) ?? 'good';
  return {
    customized: p.updated_at !== p.created_at,
    favoriteBeaches: (beaches.data ?? []).map((r) => r.bidn as string),
    favoriteSpecies: (species.data ?? [])
      .map((r) => r.species_id as string)
      .filter((id): id is SpeciesId => SPECIES_IDS.has(id)),
    prefs: prefsFromProfile(p),
    notify: {
      enabled: p.notify_enabled,
      minRating,
      localMinutes: p.notify_local_minutes,
      eveningBefore: p.notify_evening_before,
    },
  };
}

/**
 * Combines the device's state with the account's on sign-in: favorites are
 * unioned so nothing picked before signing in is lost; settings come from the
 * account if it has ever saved any, otherwise from the device.
 */
export function mergeStates(local: SyncedState, remote: RemoteState | null): SyncedState {
  if (!remote) return local;
  const union = <T,>(a: T[], b: T[]) => [...new Set([...a, ...b])];
  const species = union(remote.favoriteSpecies, local.favoriteSpecies);
  return {
    favoriteBeaches: union(remote.favoriteBeaches, local.favoriteBeaches),
    favoriteSpecies: SPECIES.map((s) => s.id).filter((id) => species.includes(id)),
    prefs: remote.customized ? remote.prefs : local.prefs,
    notify: remote.customized ? remote.notify : local.notify,
  };
}

async function replaceSet(table: 'favorite_beaches' | 'favorite_species', column: string, userId: string, want: string[]) {
  const { data, error } = await supabase.from(table).select(column).eq('user_id', userId);
  if (error) throw error;
  const have = new Set((data ?? []).map((r) => (r as unknown as Record<string, string>)[column]));
  const add = want.filter((v) => !have.has(v));
  const drop = [...have].filter((v) => !want.includes(v));
  if (add.length) {
    const { error: e } = await supabase
      .from(table)
      .upsert(add.map((v) => ({ user_id: userId, [column]: v })), { ignoreDuplicates: true });
    if (e) throw e;
  }
  if (drop.length) {
    const { error: e } = await supabase.from(table).delete().eq('user_id', userId).in(column, drop);
    if (e) throw e;
  }
}

/** Writes the whole synced state to the account. */
export async function pushRemote(userId: string, s: SyncedState): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    time_window: s.prefs.window,
    days_of_week: s.prefs.daysOfWeek ?? null,
    tide_overrides: s.prefs.tideOverrides ?? {},
    min_overlap_minutes: s.prefs.minOverlapMinutes ?? 45,
    notify_enabled: s.notify.enabled,
    notify_min_rating: s.notify.minRating,
    notify_local_minutes: s.notify.localMinutes,
    notify_evening_before: s.notify.eveningBefore,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await Promise.all([
    replaceSet('favorite_beaches', 'bidn', userId, s.favoriteBeaches),
    replaceSet('favorite_species', 'species_id', userId, s.favoriteSpecies),
  ]);
}
