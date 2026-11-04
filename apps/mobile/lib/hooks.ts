import type { TideEvent, TideStation } from '@costal-forager/core';
import { useCallback, useEffect, useState } from 'react';
import { loadBeaches, loadTides, stationFor, type Beach } from './data';

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload(): void;
}

function useLoad<T>(load: (force: boolean) => Promise<T>, deps: unknown[]): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [force, setForce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    load(force > 0)
      .then((d) => live && (setData(d), setError(null)))
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

export function useBeaches(): Loadable<Beach[]> {
  return useLoad((force) => {
    if (force || !beachesPromise) {
      beachesPromise = loadBeaches(force).catch((e) => {
        beachesPromise = null;
        throw e;
      });
    }
    return beachesPromise;
  }, []);
}

export interface BeachTides {
  station: TideStation;
  km: number;
  tides: TideEvent[];
}

const tidesMemo = new Map<string, Promise<TideEvent[]>>();

export function useBeachTides(beach: Beach | null | undefined): Loadable<BeachTides | null> {
  return useLoad(async () => {
    if (!beach) return null;
    const hit = await stationFor(beach);
    if (!hit) return null;
    let p = tidesMemo.get(hit.station.id);
    if (!p) {
      p = loadTides(hit.station.id).catch((e) => {
        tidesMemo.delete(hit.station.id);
        throw e;
      });
      tidesMemo.set(hit.station.id, p);
    }
    return { station: hit.station, km: hit.km, tides: await p };
  }, [beach?.bidn]);
}
