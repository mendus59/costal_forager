import type { TideEvent } from '@costal-forager/core';
import { useCallback, useEffect, useState } from 'react';
import { loadBeaches, loadCachedBeaches, loadCachedTides, loadTides, stationFor, type Beach } from './data';

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload(): void;
}

/**
 * Loads data, showing the last cached copy (any age) right away when `peek`
 * finds one, then replacing it with the fresh result. `loading` stays true
 * while the fresh load runs, so screens can show a small refresh indicator.
 */
function useLoad<T>(
  load: (force: boolean) => Promise<T>,
  deps: unknown[],
  peek?: () => Promise<T | null>,
): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [force, setForce] = useState(0);

  useEffect(() => {
    let live = true;
    let fresh = false;
    setLoading(true);
    if (peek && force === 0) {
      peek()
        .then((d) => live && !fresh && d != null && setData(d))
        .catch(() => {});
    }
    load(force > 0)
      .then((d) => {
        fresh = true;
        if (live) (setData(d), setError(null));
      })
      .catch((e) => live && setError(String(e?.message ?? e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, force]);

  const reload = useCallback(() => setForce((n) => n + 1), []);
  return { data, error, loading, reload };
}

// One shared in-memory copy so every screen sees the same beach list.
let beachesPromise: Promise<Beach[]> | null = null;
let beachesPeek: Promise<Beach[] | null> | null = null;

const peekBeaches = () =>
  (beachesPeek ??= loadCachedBeaches()
    .then((list) => (list.length ? list.sort((a, b) => a.name.localeCompare(b.name)) : null))
    .catch(() => null));

export function useBeaches(): Loadable<Beach[]> {
  return useLoad((force) => {
    if (force || !beachesPromise) {
      beachesPromise = loadBeaches(force).catch((e) => {
        beachesPromise = null;
        throw e;
      });
    }
    return beachesPromise;
  }, [], peekBeaches);
}

export interface BeachTides {
  station: { id: string; name: string };
  km: number;
  tides: TideEvent[];
}

const tidesMemo = new Map<string, Promise<TideEvent[]>>();

export function useBeachTides(beach: Beach | null | undefined): Loadable<BeachTides | null> {
  return useLoad(async () => {
    if (!beach) return null;
    const hit = await stationFor(beach);
    if (!hit) return null;
    let p = tidesMemo.get(hit.id);
    if (!p) {
      p = loadTides(hit.id).catch((e) => {
        tidesMemo.delete(hit.id);
        throw e;
      });
      tidesMemo.set(hit.id, p);
    }
    return { station: { id: hit.id, name: hit.name }, km: hit.km, tides: await p };
  }, [beach?.bidn], async () => {
    // Backend-assigned stations are known without any network call.
    const st = beach?.station;
    if (!st) return null;
    const tides = await loadCachedTides(st.id);
    return tides ? { station: { id: st.id, name: st.name }, km: st.km, tides } : null;
  });
}
