/**
 * Weather for a spot, straight from Open-Meteo (no backend involved).
 * Cached for 30 minutes per rounded location, and the last copy of any age is
 * shown right away while a fresh one loads.
 */
import { parseWeather, weatherUrl, type Weather } from '@costal-forager/core';

import { cached, cachedStale, getJson } from './data';
import { useLoad, type Loadable } from './hooks';

const MAX_AGE = 30 * 60000;

type StoredHour = Omit<Weather['hours'][number], 'time'> & { time: string };
interface Stored {
  now: Omit<Weather['now'], 'time'> & { time: string };
  hours: StoredHour[];
  days: Weather['days'];
}

const key = (lat: number, lng: number) => `weather:v1:${lat.toFixed(2)},${lng.toFixed(2)}`;

const toStored = (w: Weather): Stored => ({
  now: { ...w.now, time: w.now.time.toISOString() },
  hours: w.hours.map((h) => ({ ...h, time: h.time.toISOString() })),
  days: w.days,
});

const fromStored = (s: Stored): Weather => ({
  now: { ...s.now, time: new Date(s.now.time) },
  hours: s.hours.map((h) => ({ ...h, time: new Date(h.time) })),
  days: s.days,
});

// One request per spot at a time, shared by every card that shows it.
const inflight = new Map<string, Promise<Weather>>();

export function loadWeather(lat: number, lng: number, force = false): Promise<Weather> {
  const k = key(lat, lng);
  let p = force ? undefined : inflight.get(k);
  if (!p) {
    p = cached(k, force ? 0 : MAX_AGE, async () => toStored(parseWeather(await getJson(weatherUrl(lat, lng)))))
      .then((s) => {
        setTimeout(() => inflight.delete(k), 60000);
        return fromStored(s);
      })
      .catch((e) => {
        inflight.delete(k);
        throw e;
      });
    inflight.set(k, p);
  }
  return p;
}

export function useWeather(point: { lat: number; lng: number } | null | undefined): Loadable<Weather | null> {
  const lat = point?.lat;
  const lng = point?.lng;
  return useLoad(
    (force) => (lat == null || lng == null ? Promise.resolve(null) : loadWeather(lat, lng, force)),
    [lat, lng],
    async () => {
      if (lat == null || lng == null) return null;
      const s = await cachedStale<Stored>(key(lat, lng));
      return s ? fromStored(s) : null;
    },
  );
}
