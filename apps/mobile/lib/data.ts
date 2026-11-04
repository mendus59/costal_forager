/**
 * Data access. Until the Supabase backend is connected (step 3), the app reads
 * the public sources directly: the DOH beaches layer and NOAA tide predictions.
 * Responses are cached in AsyncStorage so the app opens fast and works offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDays,
  dohQueryUrl,
  localDateKey,
  nearest,
  NOAA_STATIONS_URL,
  parseDohQuery,
  parsePredictions,
  parseStations,
  predictionsUrl,
  dateChunks,
  razorBeachFor,
  regionOf,
  beachPoint,
  type BeachContext,
  type DohBeach,
  type TideEvent,
  type TideStation,
} from '@costal-forager/core';

const HOUR = 3600000;
const DAY = 24 * HOUR;

async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const { at, value } = JSON.parse(raw) as { at: number; value: T };
      if (Date.now() - at < maxAgeMs) return value;
    }
  } catch {
    // Storage unavailable or corrupt: fall through to a fresh load.
  }
  const value = await load();
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Not fatal; the next open just reloads.
  }
  return value;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface Beach extends DohBeach {
  region: 'puget_sound' | 'pacific_coast';
  location: { lat: number; lng: number } | null;
}

/** All DOH-monitored beaches with today's status (refreshed hourly). */
export async function loadBeaches(force = false): Promise<Beach[]> {
  const pages = await cached('doh:v1', force ? 0 : HOUR, async () => {
    const out: unknown[] = [];
    for (let offset = 0; ; offset += 2000) {
      const json = await getJson(dohQueryUrl(offset, '1=1', { geometry: false }));
      out.push(json);
      const { beaches, more } = parseDohQuery(json);
      if (!more || beaches.length === 0) break;
    }
    return out;
  });
  const byBidn = new Map<string, Beach>();
  for (const page of pages) {
    for (const b of parseDohQuery(page).beaches) {
      if (!byBidn.has(b.bidn)) byBidn.set(b.bidn, { ...b, region: regionOf(b), location: beachPoint(b) });
    }
  }
  return [...byBidn.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadStations(): Promise<TideStation[]> {
  return cached('stations:v1', 30 * DAY, async () => parseStations(await getJson(NOAA_STATIONS_URL)));
}

export async function stationFor(beach: Beach): Promise<{ station: TideStation; km: number } | null> {
  if (!beach.location) return null;
  const hit = nearest(beach.location, await loadStations());
  return hit ? { station: hit.item, km: hit.km } : null;
}

type StoredTide = [string, number, 'H' | 'L'];

/** About a year of high/low predictions for a station, cached for a week. */
export async function loadTides(stationId: string): Promise<TideEvent[]> {
  const today = localDateKey(new Date());
  const begin = addDays(today, -1);
  const end = addDays(today, 370);
  const stored = await cached<StoredTide[]>(`tides:${stationId}:v1`, 7 * DAY, async () => {
    const all: StoredTide[] = [];
    for (const [b, e] of dateChunks(begin, end)) {
      for (const t of parsePredictions(await getJson(predictionsUrl(stationId, b, e)))) {
        all.push([t.time.toISOString(), t.heightFt, t.type]);
      }
    }
    return all;
  });
  return stored.map(([t, h, type]) => ({ time: new Date(t), heightFt: h, type }));
}

/** Scoring context for a beach. Razor dig days arrive with the backend (step 3). */
export function toContext(b: Beach, razorDigDates: readonly string[] = []): BeachContext | null {
  if (!b.location) return null;
  return {
    bidn: b.bidn,
    name: b.name,
    location: b.location,
    region: b.region,
    doh: b,
    razorBeach: razorBeachFor(b.name),
    razorDigDates,
  };
}
