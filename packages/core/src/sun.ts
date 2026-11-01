/**
 * Sunrise and sunset, computed locally (no network). This is the standard
 * low-precision solar position algorithm (the same one the `suncalc` library
 * uses), accurate to about a minute at Washington latitudes.
 */
import { zonedTime, WA_TZ } from "./time.ts";

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const OBLIQUITY = RAD * 23.4397;
/** Sun's upper limb touching the horizon, with refraction. */
const SUNRISE_ALTITUDE = -0.833 * RAD;

const toJulian = (date: Date) => date.getTime() / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date: Date) => toJulian(date) - J2000;

const solarMeanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);

function eclipticLongitude(m: number): number {
  const center = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const perihelion = RAD * 102.9372;
  return m + center + perihelion + Math.PI;
}

const declination = (l: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (ht: number, lw: number, n: number) => J0 + (ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
const hourAngle = (h: number, phi: number, dec: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
}

/** Sun times for the local calendar day `dateKey` ("YYYY-MM-DD") at a point. */
export function sunTimes(dateKey: string, lat: number, lng: number, tz = WA_TZ): SunTimes {
  const noonLocal = zonedTime(dateKey, 12 * 60, tz);
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(noonLocal);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l);
  const jNoon = solarTransitJ(ds, m, l);
  const w = hourAngle(SUNRISE_ALTITUDE, phi, dec);
  const jSet = solarTransitJ(approxTransit(w, lw, n), m, l);
  const jRise = jNoon - (jSet - jNoon);
  return { sunrise: fromJulian(jRise), sunset: fromJulian(jSet), solarNoon: fromJulian(jNoon) };
}
