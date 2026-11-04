/**
 * The user's favorites and scoring preferences, kept on the device.
 * Step 3 syncs these to the user's account.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PREFS, SPECIES, type ScoringPrefs, type SpeciesId } from '@costal-forager/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'user:v1';

export interface UserState {
  favoriteBeaches: string[];
  favoriteSpecies: SpeciesId[];
  prefs: ScoringPrefs;
}

const DEFAULT_STATE: UserState = {
  favoriteBeaches: [],
  favoriteSpecies: ['oyster', 'manila_clam', 'native_littleneck', 'butter_clam', 'razor_clam'],
  prefs: DEFAULT_PREFS,
};

interface Store extends UserState {
  ready: boolean;
  toggleBeach(bidn: string): void;
  toggleSpecies(id: SpeciesId): void;
  setPrefs(update: (p: ScoringPrefs) => ScoringPrefs): void;
  reset(): void;
}

const Ctx = createContext<Store | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<UserState>) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((fn: (s: UserState) => UserState) => {
    setState((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const store = useMemo<Store>(
    () => ({
      ...state,
      ready,
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
      reset: () => update(() => DEFAULT_STATE),
    }),
    [state, ready, update],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useUser(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useUser must be used inside UserProvider');
  return s;
}
