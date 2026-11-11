/**
 * Data access.
 *
 * The app prefers the Supabase backend, which the sync jobs keep filled with
 * DOH status, NOAA tides, WDFW razor clam digs and beach harvest profiles.
 * If the backend is unreachable or not deployed yet, it falls back to reading
 * the DOH layer and NOAA directly (no razor digs or profiles in that mode).
 * Everything is cached in AsyncStorage so the app opens fast and works offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  absentSpeciesOf,
  addDays,
  BEACH_SELECT,
  beachPoint,
  dateChunks,
  digDatesFor,
  dohFromRow,
  dohQueryUrl,
  localDateKey,
  nearest,
  NOAA_STATIONS_URL,
  parseClosedFor,
  parseDohQuery,
  parsePredictions,
  parseStations,
  parseStatus,
  predictionsUrl,
  razorBeachFor,
  regionOf,
  type BeachContext,
  type BeachRow,
  type DigRow,
  type DohBeach,
  type RazorClamBeach,
  type SpeciesId,
  type TideEvent,
  type TideStation,
} from '@costal-forager/core';

import { supabase } from './supabase';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export async function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
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

/** Last good cached value regardless of age, for offline use (widgets, background). */
export async function cachedStale<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { value: T }).value : null;
  } catch {
    return null;
  }
}

export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface Beach extends DohBeach {
  region: 'puget_sound' | 'pacific_coast';
  location: { lat: number; lng: number } | null;
  razorBeach: RazorClamBeach | null;
  /** Announced razor clam dig dates for this beach's razor area. */
  razorDigDates: string[];
  /** Species the WDFW harvest profile says are absent. */
  absentSpecies: SpeciesId[];
  /** Tide station assigned by the backend, if any. */
  station: { id: string; name: string; km: number } | null;
}

export type DataSource = 'supabase' | 'direct';
export let lastSource: DataSource = 'direct';

// ---------------------------------------------------------------------------
// Supabase

const PAGE = 1000;

async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(String((error as { message?: string }).message ?? error));
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}



async function fetchSupabase(): Promise<{ beaches: BeachRow[]; digs: DigRow[] }> {
  // The beach list and the razor dig dates are independent, so fetch them together.
  const beachesP = selectAll<BeachRow>((from, to) =>
    supabase
      .from('beaches')
      .select(BEACH_SELECT)
      .eq('in_doh_layer', true)
      .order('bidn')
      .range(from, to) as unknown as PromiseLike<{ data: BeachRow[] | null; error: unknown }>,
  );
  const digsP = supabase
    .from('razor_digs')
    .select('dig_date, razor_beach')
    .eq('cancelled', false)
    .gte('dig_date', addDays(localDateKey(new Date()), -1));
  const [beaches, { data: digs, error }] = await Promise.all([beachesP, digsP]);
  if (beaches.length === 0) throw new Error('Backend has no beaches yet');
  if (error) throw new Error(error.message);
  return { beaches, digs: (digs ?? []) as DigRow[] };
}

function fromRow(r: BeachRow, digs: DigRow[]): Beach {
  const doh = dohFromRow(r);
  return {
    ...doh,
    region: r.region,
    location: doh.midpoint,
    razorBeach: r.razor_beach,
    razorDigDates: digDatesFor(r.razor_beach, digs),
    absentSpecies: absentSpeciesOf(r),
    station: r.station_id
      ? { id: r.station_id, name: r.tide_stations?.name ?? r.station_id, km: Number(r.station_km ?? 0) }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Direct (no backend)

async function fetchDohPages(): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let offset = 0; ; offset += 2000) {
    const json = await getJson(dohQueryUrl(offset, '1=1', { geometry: false }));
    out.push(json);
    const { beaches, more } = parseDohQuery(json);
    if (!more || beaches.length === 0) break;
  }
  return out;
}

function fromDoh(pages: unknown[]): Beach[] {
  const byBidn = new Map<string, Beach>();
  for (const page of pages) {
    for (const b of parseDohQuery(page).beaches) {
      if (byBidn.has(b.bidn)) continue;
      byBidn.set(b.bidn, {
        ...b,
        updatedAt: b.updatedAt ? new Date(b.updatedAt) : null,
        region: regionOf(b),
        location: beachPoint(b),
        razorBeach: razorBeachFor(b.name),
        razorDigDates: [],
        absentSpecies: [],
        station: null,
      });
    }
  }
  return [...byBidn.values()];
}

// ---------------------------------------------------------------------------

export const BEACHES_SB_KEY = 'beaches:sb:v1';
export const BEACHES_DOH_KEY = 'doh:v1';

/** All monitored beaches with today's status (refreshed hourly). */
export async function loadBeaches(force = false): Promise<Beach[]> {
  const maxAge = force ? 0 : HOUR;
  let list: Beach[];
  try {
    const { beaches, digs } = await cached(BEACHES_SB_KEY, maxAge, fetchSupabase);
    list = beaches.map((r) => fromRow(r, digs));
    lastSource = 'supabase';
  } catch {
    list = fromDoh(await cached(BEACHES_DOH_KEY, maxAge, fetchDohPages));
    lastSource = 'direct';
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** Beaches from cache only (any age), for background work with no network. */
export async function loadCachedBeaches(): Promise<Beach[]> {
  const sb = await cachedStale<{ beaches: BeachRow[]; digs: DigRow[] }>(BEACHES_SB_KEY);
  if (sb) return sb.beaches.map((r) => fromRow(r, sb.digs));
  const doh = await cachedStale<unknown[]>(BEACHES_DOH_KEY);
  return doh ? fromDoh(doh) : [];
}

export async function loadStations(): Promise<TideStation[]> {
  return cached('stations:v1', 30 * DAY, async () => parseStations(await getJson(NOAA_STATIONS_URL)));
}

/** The beach's tide station: the backend's assignment, else the nearest NOAA station. */
export async function stationFor(beach: Beach): Promise<{ id: string; name: string; km: number } | null> {
  if (beach.station) return beach.station;
  if (!beach.location) return null;
  const hit = nearest(beach.location, await loadStations());
  return hit ? { id: hit.item.id, name: hit.item.name, km: hit.km } : null;
}

type StoredTide = [string, number, 'H' | 'L'];

const tidesKey = (stationId: string) => `tides:${stationId}:v1`;

async function fetchTidesSupabase(stationId: string, begin: string, end: string): Promise<StoredTide[]> {
  const rows = await selectAll<{ at: string; height_ft: number; kind: 'H' | 'L' }>((from, to) =>
    supabase
      .from('tide_events')
      .select('at, height_ft, kind')
      .eq('station_id', stationId)
      .gte('at', `${begin}T00:00:00Z`)
      .lte('at', `${end}T23:59:59Z`)
      .order('at')
      .range(from, to) as unknown as PromiseLike<{ data: { at: string; height_ft: number; kind: 'H' | 'L' }[] | null; error: unknown }>,
  );
  if (rows.length === 0) throw new Error('No tides in backend');
  return rows.map((r) => [r.at, Number(r.height_ft), r.kind]);
}

async function fetchTidesNoaa(stationId: string, begin: string, end: string): Promise<StoredTide[]> {
  const chunks = await Promise.all(
    dateChunks(begin, end).map(async ([b, e]) => parsePredictions(await getJson(predictionsUrl(stationId, b, e)))),
  );
  return chunks.flat().map((t): StoredTide => [t.time.toISOString(), t.heightFt, t.type]);
}

const revive = (stored: StoredTide[]): TideEvent[] =>
  stored.map(([t, h, type]) => ({ time: new Date(t), heightFt: h, type }));

/** About a year of high/low predictions for a station, cached for a week. */
export async function loadTides(stationId: string): Promise<TideEvent[]> {
  const today = localDateKey(new Date());
  const begin = addDays(today, -1);
  const end = addDays(today, 370);
  const stored = await cached<StoredTide[]>(tidesKey(stationId), 7 * DAY, async () => {
    try {
      return await fetchTidesSupabase(stationId, begin, end);
    } catch {
      return fetchTidesNoaa(stationId, begin, end);
    }
  });
  return revive(stored);
}

export async function loadCachedTides(stationId: string): Promise<TideEvent[] | null> {
  const stored = await cachedStale<StoredTide[]>(tidesKey(stationId));
  return stored ? revive(stored) : null;
}

/** Scoring context for a beach. */
export function toContext(b: Beach): BeachContext | null {
  if (!b.location) return null;
  return {
    bidn: b.bidn,
    name: b.name,
    location: b.location,
    region: b.region,
    doh: b.status === 'unknown' && !b.clamSeason ? null : b,
    razorBeach: b.razorBeach,
    razorDigDates: b.razorDigDates,
    absentSpecies: b.absentSpecies,
  };
}

// Re-exported for screens that format closures.
export { parseClosedFor };
