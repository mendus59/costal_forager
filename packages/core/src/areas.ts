/**
 * Tide stations across the US and "areas" of stations that tide together,
 * ported from TideWidget (tidecore/Areas.kt, Geo.kt).
 *
 * NOAA predicts most stations ("subordinate") as fixed time and height
 * offsets from a nearby "reference" station, so a reference station and its
 * subordinates rise and fall nearly in step. Grouping by that reference gives
 * each area a general feel for when highs and lows come through.
 */
import { distanceKm, type LatLng } from "./geo.ts";
import type { TideEvent } from "./noaa.ts";

export interface UsTideStation {
  id: string;
  name: string;
  /** "WA", or null for stations NOAA lists without one. */
  state: string | null;
  lat: number;
  lng: number;
  referenceId: string | null;
}

/** Every station in NOAA's tide-prediction metadata list (about 3,000). */
export function parseAllStations(json: unknown): UsTideStation[] {
  const body = json as { stations?: { id: string; name: string; lat: number; lng: number; state?: string; reference_id?: string }[] };
  return (body.stations ?? [])
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      state: s.state || null,
      lat: Number(s.lat),
      lng: Number(s.lng),
      referenceId: s.reference_id ? String(s.reference_id) : null,
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

/** "Seattle, WA" */
export const stationLabel = (s: { name: string; state?: string | null }) => [s.name, s.state].filter(Boolean).join(", ");

/** The `n` items closest to `point`, nearest first, with their distances. */
export function nearestN<T extends LatLng>(point: LatLng, items: readonly T[], n: number): { item: T; km: number }[] {
  return items
    .map((item) => ({ item, km: distanceKm(point, item) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

export const KM_PER_MILE = 1.609344;

export interface TideArea {
  /** The reference station's id. */
  id: string;
  name: string;
  state: string | null;
  /** The reference station first, then its subordinates nearest to it. */
  stations: UsTideStation[];
  lat: number;
  lng: number;
}

/** Group stations by the reference station NOAA predicts them from. */
export function groupAreas(stations: readonly UsTideStation[]): TideArea[] {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const groups = new Map<string, UsTideStation[]>();
  for (const s of stations) {
    const ref = s.referenceId && byId.has(s.referenceId) ? s.referenceId : s.id;
    const g = groups.get(ref);
    if (g) g.push(s);
    else groups.set(ref, [s]);
  }
  return [...groups].map(([refId, members]) => {
    const ref = byId.get(refId)!;
    const ordered = [ref, ...members.filter((m) => m.id !== refId).sort((a, b) => distanceKm(ref, a) - distanceKm(ref, b))];
    return {
      id: refId,
      name: ref.name,
      state: ref.state,
      stations: ordered,
      lat: ordered.reduce((n, s) => n + s.lat, 0) / ordered.length,
      lng: ordered.reduce((n, s) => n + s.lng, 0) / ordered.length,
    };
  });
}

/** When the next high (or low) arrives across an area: its earliest and latest station. */
export interface TideWindow {
  first: TideEvent;
  last: TideEvent;
}

export interface AreaOutlook {
  high: TideWindow | null;
  low: TideWindow | null;
  stationsReporting: number;
}

/**
 * The next high and low window across an area's forecasts. Stations whose
 * next tide is more than `maxSpreadMs` after the earliest are already on the
 * following tide and are left out.
 */
export function areaOutlook(forecasts: readonly (readonly TideEvent[])[], at: Date, maxSpreadMs = 4 * 3600000): AreaOutlook {
  const window = (type: "H" | "L"): TideWindow | null => {
    const next = forecasts
      .map((ev) => ev.find((e) => e.type === type && e.time.getTime() > at.getTime()))
      .filter((e): e is TideEvent => !!e)
      .sort((a, b) => a.time.getTime() - b.time.getTime());
    if (next.length === 0) return null;
    const first = next[0];
    const inStep = next.filter((e) => e.time.getTime() - first.time.getTime() <= maxSpreadMs);
    return { first, last: inStep[inStep.length - 1] };
  };
  return { high: window("H"), low: window("L"), stationsReporting: forecasts.length };
}
