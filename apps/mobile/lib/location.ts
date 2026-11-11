/**
 * The user's rough location, for centering the tide map and listing nearby
 * areas, like TideWidget. Asks once; null when not allowed or unavailable.
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface Here {
  lat: number;
  lng: number;
}

let pending: Promise<Here | null> | null = null;

export function getHere(): Promise<Here | null> {
  return (pending ??= (async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return null;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return null;
    }
  })());
}

/** The user's location once known (undefined while asking, null if unavailable). */
export function useHere(): Here | null | undefined {
  const [here, setHere] = useState<Here | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getHere().then((h) => live && setHere(h));
    return () => {
      live = false;
    };
  }, []);
  return here;
}
