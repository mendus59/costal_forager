/**
 * The user's favorites, scoring preferences and alert settings. Kept on the
 * device and backed up to an anonymous Supabase account that the app creates
 * on first launch (no email or password), which also owns the push token.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { DEFAULT_PREFS, SPECIES, type ScoringPrefs, type SpeciesId } from '@costal-forager/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import { DEFAULT_NOTIFY, mergeStates, pullRemote, pushRemote, type NotifySettings, type SyncedState } from './sync';

const KEY = 'user:v1';

export type UserState = SyncedState;
export type { NotifySettings };

const DEFAULT_STATE: UserState = {
  favoriteBeaches: [],
  favoriteSpecies: ['oyster', 'manila_clam', 'native_littleneck', 'butter_clam', 'razor_clam'],
  prefs: DEFAULT_PREFS,
  notify: DEFAULT_NOTIFY,
};

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface Store extends UserState {
  ready: boolean;
  /** This install's anonymous account, or null until it is created. */
  account: { id: string } | null;
  sync: SyncStatus;
  syncError: string | null;
  toggleBeach(bidn: string): void;
  toggleSpecies(id: SpeciesId): void;
  setPrefs(update: (p: ScoringPrefs) => ScoringPrefs): void;
  setNotify(update: (n: NotifySettings) => NotifySettings): void;
  reset(): void;
}

const Ctx = createContext<Store | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sync, setSync] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  // Local edits are pushed only after the first pull, so a fresh device never
  // overwrites the account before merging with it.
  const merged = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as Partial<UserState>;
          setState({ ...DEFAULT_STATE, ...saved, notify: { ...DEFAULT_NOTIFY, ...saved.notify } });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    // Every install gets an anonymous account the first time it runs. If it
    // fails (offline), the app keeps working locally and tries again next launch.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) return setSession(data.session);
        const { data: anon, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        setSession(anon.session);
      })
      .catch((e) => setSyncError(String(e?.message ?? e)));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const save = (next: UserState) => AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});

  const push = useCallback((userId: string) => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      setSync('syncing');
      pushRemote(userId, stateRef.current)
        .then(() => (setSync('synced'), setSyncError(null)))
        .catch((e) => (setSync('error'), setSyncError(String(e?.message ?? e))));
    }, 800);
  }, []);

  // Merge with the account once per session.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      merged.current = null;
      setSync('local');
      return;
    }
    if (merged.current === userId) return;
    let live = true;
    setSync('syncing');
    pullRemote(userId)
      .then((remote) => {
        if (!live) return;
        const next = mergeStates(stateRef.current, remote);
        setState(next);
        save(next);
        stateRef.current = next;
        merged.current = userId;
        push(userId);
      })
      .catch((e) => live && (setSync('error'), setSyncError(String(e?.message ?? e))));
    return () => {
      live = false;
    };
  }, [ready, userId, push]);

  const update = useCallback(
    (fn: (s: UserState) => UserState) => {
      setState((prev) => {
        const next = fn(prev);
        save(next);
        return next;
      });
      if (userId && merged.current === userId) push(userId);
    },
    [userId, push],
  );

  const store = useMemo<Store>(
    () => ({
      ...state,
      ready,
      account: session ? { id: session.user.id } : null,
      sync,
      syncError,
      toggleBeach: (bidn) =>
        update((s) => ({
          ...s,
          favoriteBeaches: s.favoriteBeaches.includes(bidn)
            ? s.favoriteBeaches.filter((b) => b !== bidn)
            : [...s.favoriteBeaches, bidn],
        })),
      toggleSpecies: (id) =>
        update((s) => {
          const has = s.favoriteSpecies.includes(id);
          const next = has ? s.favoriteSpecies.filter((x) => x !== id) : [...s.favoriteSpecies, id];
          // Keep the table order so lists read the same everywhere.
          return { ...s, favoriteSpecies: SPECIES.map((sp) => sp.id).filter((x) => next.includes(x)) };
        }),
      setPrefs: (fn) => update((s) => ({ ...s, prefs: fn(s.prefs) })),
      setNotify: (fn) => update((s) => ({ ...s, notify: fn(s.notify) })),
      reset: () => update(() => DEFAULT_STATE),
    }),
    [state, ready, session, sync, syncError, update],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useUser(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useUser must be used inside UserProvider');
  return s;
}
