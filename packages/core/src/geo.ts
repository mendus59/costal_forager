export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_KM = 6371;

export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** The closest item to `point`, with its distance; null for an empty list. */
export function nearest<T extends LatLng>(point: LatLng, items: readonly T[]): { item: T; km: number } | null {
  let best: { item: T; km: number } | null = null;
  for (const item of items) {
    const km = distanceKm(point, item);
    if (!best || km < best.km) best = { item, km };
  }
  return best;
}
