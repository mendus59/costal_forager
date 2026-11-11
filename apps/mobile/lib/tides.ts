/**
 * Tide data for any NOAA station in the US, for the features ported from
 * TideWidget (tide map, station week view, areas). Beaches keep using
 * loadTides in data.ts, which reads a year of Washington tides from the
 * backend; these load a short forecast straight from NOAA.
 */
import {
  addDays,
  groupAreas,
  localDateKey,
  NOAA_STATIONS_URL,
  parseAllStations,
  parsePredictions,
  predictionsUrl,
  type TideArea,
  type TideEvent,
  type UsTideStation,
} from '@costal-forager/core';

import { cached, cachedStale, getJson } from './data';

const HOUR = 3600000;

/** Every NOAA tide-prediction station (about 3,000), cached for 30 days. */
export async function loadUsStations(): Promise<UsTideStation[]> {
  return cached('stations:us:v1', 30 * 24 * HOUR, async () => parseAllStations(await getJson(NOAA_STATIONS_URL)));
}

let areasPromise: Promise<TideArea[]> | null = null;
/** Stations grouped by the reference station they are predicted from. */
export function loadAreas(): Promise<TideArea[]> {
  return (areasPromise ??= loadUsStations()
    .then(groupAreas)
    .catch((e) => {
      areasPromise = null;
      throw e;
    }));
}

type Stored = [string, number, 'H' | 'L'];
const forecastKey = (id: string) => `forecast:${id}:v1`;
const revive = (s: Stored[]): TideEvent[] => s.map(([t, h, type]) => ({ time: new Date(t), heightFt: h, type }));

const memory = new Map<string, Promise<TideEvent[]>>();

/** Highs and lows from yesterday through 8 days ahead, cached for 6 hours. */
export function loadForecast(stationId: string): Promise<TideEvent[]> {
  const hit = memory.get(stationId);
  if (hit) return hit;
  const p = cached<Stored[]>(forecastKey(stationId), 6 * HOUR, async () => {
    const today = localDateKey(new Date());
    const events = parsePredictions(await getJson(predictionsUrl(stationId, addDays(today, -1), addDays(today, 8))));
    return events.map((e): Stored => [e.time.toISOString(), e.heightFt, e.type]);
  })
    .then(revive)
    .catch(async (e) => {
      memory.delete(stationId);
      const stale = await cachedStale<Stored[]>(forecastKey(stationId));
      if (stale) return revive(stale);
      throw e;
    });
  memory.set(stationId, p);
  return p;
}
