/**
 * Ideal-day scoring.
 *
 * A day is scored per beach and species in three steps:
 *  1. Gate: is it legal? (season on that date, DOH health closures, razor dig
 *     days). A day that fails is "closed", never a low score.
 *  2. Tide fit: 1 at or below the species' ideal low tide, 0 at or above its
 *     marginal height, linear in between.
 *  3. Window fit: the share of the harvest window around the low that falls
 *     inside the user's acceptable hours (default: daylight, sunrise - 1 h to
 *     sunset + 1 h, matching WDFW's tide chart).
 *
 * score = tideFit x windowFit, rated great >= 0.8, good >= 0.5, marginal >= 0.2.
 */
import type { DateRange, DohStatus } from "./doh.ts";
import type { LatLng } from "./geo.ts";
import type { TideEvent } from "./noaa.ts";
import { getSpecies, type RazorClamBeach, type Species, type SpeciesId } from "./species.ts";
import { sunTimes } from "./sun.ts";
import { addDays, dayOfWeek, localDateKey, parseDateKey, WA_TZ, zonedTime } from "./time.ts";

export type Rating = "great" | "good" | "marginal" | "poor" | "closed";

export const RATING_ORDER: Record<Rating, number> = { closed: 0, poor: 1, marginal: 2, good: 3, great: 4 };

export type TimeWindow =
  | { kind: "daylight"; paddingMinutes: number }
  /** Local minutes after midnight. An end at or before the start wraps past midnight. */
  | { kind: "custom"; startMinutes: number; endMinutes: number };

export interface ScoringPrefs {
  window: TimeWindow;
  /** Per-species overrides of the ideal and marginal tide heights (ft MLLW). */
  tideOverrides?: Partial<Record<SpeciesId, { idealTideFt?: number; marginalTideFt?: number }>>;
  /** Allowed days of the week, 0 = Sunday. Omit for every day. */
  daysOfWeek?: number[];
  /** Minimum minutes of overlap with the window for a low to count. */
  minOverlapMinutes?: number;
}

export const DEFAULT_PREFS: ScoringPrefs = {
  window: { kind: "daylight", paddingMinutes: 60 },
  minOverlapMinutes: 45,
};

/** What scoring needs to know about a beach. */
export interface BeachContext {
  bidn: string;
  name: string;
  location: LatLng;
  region: "puget_sound" | "pacific_coast";
  /** Null when the beach is not in the DOH layer (status unknown). */
  doh: {
    status: DohStatus;
    closedFor: SpeciesId[] | "all";
    clamSeason: DateRange | null;
    oysterSeason: DateRange | null;
    vibrio: boolean;
    emergency: string | null;
  } | null;
  /** For coastal beaches inside a razor clam management area. */
  razorBeach: RazorClamBeach | null;
  /** Local dates ("YYYY-MM-DD") of announced digs for `razorBeach`. */
  razorDigDates: readonly string[];
  /** Species the WDFW harvest profile says are absent here. */
  absentSpecies?: readonly SpeciesId[];
}

export type Gate = { legal: true; cautions: string[] } | { legal: false; reason: string };

const inRange = (key: string, r: DateRange | null) => !!r && key >= r.start && key <= r.end;

/** Nov 1 to Mar 31, the Pacific coast mussel and goose barnacle season. */
function inWinterSeason(key: string): boolean {
  const [, m] = parseDateKey(key);
  return m >= 11 || m <= 3;
}

function inSeason(sp: Species, beach: BeachContext, key: string): boolean {
  const doh = beach.doh;
  switch (sp.seasonGroup) {
    case "razor":
      return beach.razorBeach !== null && beach.razorDigDates.includes(key);
    case "clam":
      return inRange(key, doh?.clamSeason ?? null);
    case "oyster":
      return inRange(key, doh?.oysterSeason ?? doh?.clamSeason ?? null);
    case "mussel":
      return beach.region === "pacific_coast" ? inWinterSeason(key) : inRange(key, doh?.clamSeason ?? null);
    case "barnacle":
      return beach.region === "pacific_coast" ? inWinterSeason(key) : true;
    case "year_round":
      return true;
  }
}

/** Is harvesting `speciesId` at `beach` on local date `key` allowed? */
export function gate(speciesId: SpeciesId, beach: BeachContext, key: string, todayKey: string): Gate {
  const sp = getSpecies(speciesId);
  if (sp.region !== "both" && sp.region !== beach.region) {
    return { legal: false, reason: `${sp.plural} are not found in this area` };
  }
  if (beach.absentSpecies?.includes(speciesId)) {
    return { legal: false, reason: `WDFW does not expect ${sp.plural.toLowerCase()} on this beach` };
  }
  // Razor clam beaches are opened by WDFW announcement, not the DOH layer.
  if (sp.seasonGroup === "razor") {
    return inSeason(sp, beach, key)
      ? { legal: true, cautions: key > todayKey ? ["Digs can be cancelled if toxin tests change"] : [] }
      : { legal: false, reason: "No razor clam dig announced for this day" };
  }
  const doh = beach.doh;
  if (!doh) return { legal: false, reason: "Not monitored by DOH; check the DOH safety map" };
  if (!inSeason(sp, beach, key)) return { legal: false, reason: "WDFW season closed" };

  const closedNow = doh.status === "closed" || doh.closedFor === "all" || doh.closedFor.includes(speciesId);
  const cautions: string[] = [];
  if (closedNow) {
    // DOH's status is today's. If today is out of season, "closed" may only
    // reflect the season, so a later in-season day is not ruled out.
    if (key === todayKey || inSeason(sp, beach, todayKey)) return { legal: false, reason: "Closed by DOH" };
    cautions.push("Closed today; DOH must reopen it before this date");
  }
  if (doh.status === "conditional") cautions.push("Conditionally open; check DOH");
  if (doh.status === "unclassified") cautions.push("Not evaluated by DOH for pollution");
  if (doh.vibrio) cautions.push("Vibrio advisory; cook shellfish thoroughly");
  if (doh.emergency) cautions.push(doh.emergency);
  if (key > todayKey) cautions.push("Forecast; DOH status can change before then");
  return { legal: true, cautions };
}

export interface Interval {
  start: Date;
  end: Date;
}

/** The user's acceptable hours on a local date. */
export function acceptableWindow(key: string, where: LatLng, window: TimeWindow, tz = WA_TZ): Interval {
  if (window.kind === "daylight") {
    const sun = sunTimes(key, where.lat, where.lng, tz);
    const pad = window.paddingMinutes * 60000;
    return { start: new Date(sun.sunrise.getTime() - pad), end: new Date(sun.sunset.getTime() + pad) };
  }
  const end = window.endMinutes <= window.startMinutes ? window.endMinutes + 1440 : window.endMinutes;
  return { start: zonedTime(key, window.startMinutes, tz), end: zonedTime(key, end, tz) };
}

const overlapMs = (a: Interval, b: Interval) =>
  Math.max(0, Math.min(a.end.getTime(), b.end.getTime()) - Math.max(a.start.getTime(), b.start.getTime()));

export function tideFit(heightFt: number, ideal: number, marginal: number): number {
  if (heightFt <= ideal) return 1;
  if (heightFt >= marginal) return 0;
  return (marginal - heightFt) / (marginal - ideal);
}

export function ratingFor(score: number): Rating {
  if (score >= 0.8) return "great";
  if (score >= 0.5) return "good";
  if (score >= 0.2) return "marginal";
  return "poor";
}

export interface LowScore {
  low: TideEvent;
  harvest: Interval;
  /** The part of the harvest window inside the user's hours. */
  usable: Interval | null;
  tideFit: number;
  windowFit: number;
  score: number;
}

export interface DayScore {
  date: string;
  bidn: string;
  speciesId: SpeciesId;
  rating: Rating;
  score: number;
  best: LowScore | null;
  gate: Gate;
  /** False when the user's day-of-week filter excludes this day. */
  allowedDay: boolean;
}

function scoreLow(sp: Species, low: TideEvent, accept: Interval, prefs: ScoringPrefs): LowScore {
  const ideal = prefs.tideOverrides?.[sp.id]?.idealTideFt ?? sp.idealTideFt;
  const marginal = prefs.tideOverrides?.[sp.id]?.marginalTideFt ?? sp.marginalTideFt;
  const t = low.time.getTime();
  const harvest = { start: new Date(t - sp.hoursBeforeLow * 3600000), end: new Date(t + sp.hoursAfterLow * 3600000) };
  const lengthMs = harvest.end.getTime() - harvest.start.getTime();
  const ov = overlapMs(harvest, accept);
  const minOverlap = Math.min(prefs.minOverlapMinutes ?? 45, lengthMs / 60000) * 60000;
  const windowFit = ov >= minOverlap && lengthMs > 0 ? ov / lengthMs : 0;
  const fit = tideFit(low.heightFt, ideal, marginal);
  const usable =
    ov > 0
      ? {
          start: new Date(Math.max(harvest.start.getTime(), accept.start.getTime())),
          end: new Date(Math.min(harvest.end.getTime(), accept.end.getTime())),
        }
      : null;
  return { low, harvest, usable, tideFit: fit, windowFit, score: fit * windowFit };
}

/** Low tides whose time falls on the local date. */
export function lowsOn(key: string, tides: readonly TideEvent[], tz = WA_TZ): TideEvent[] {
  return lowsIndex(tides, tz).get(key) ?? [];
}

// Scoring looks up one day at a time across hundreds of days, so each tide
// list is grouped by local date once instead of filtered on every call.
// (Tide lists are treated as immutable once scored.)
const lowsIndexes = new WeakMap<readonly TideEvent[], Map<string, Map<string, TideEvent[]>>>();

function lowsIndex(tides: readonly TideEvent[], tz: string): Map<string, TideEvent[]> {
  let byTz = lowsIndexes.get(tides);
  if (!byTz) lowsIndexes.set(tides, (byTz = new Map()));
  let index = byTz.get(tz);
  if (!index) {
    index = new Map();
    for (const e of tides) {
      if (e.type !== "L") continue;
      const k = localDateKey(e.time, tz);
      const list = index.get(k);
      if (list) list.push(e);
      else index.set(k, [e]);
    }
    byTz.set(tz, index);
  }
  return index;
}

export function scoreDay(
  speciesId: SpeciesId,
  beach: BeachContext,
  key: string,
  tides: readonly TideEvent[],
  prefs: ScoringPrefs = DEFAULT_PREFS,
  todayKey: string = key,
): DayScore {
  const sp = getSpecies(speciesId);
  const g = gate(speciesId, beach, key, todayKey);
  const allowedDay = !prefs.daysOfWeek || prefs.daysOfWeek.includes(dayOfWeek(key));
  const accept = acceptableWindow(key, beach.location, prefs.window);
  let best: LowScore | null = null;
  for (const low of lowsOn(key, tides)) {
    const s = scoreLow(sp, low, accept, prefs);
    if (!best || s.score > best.score || (s.score === best.score && s.low.heightFt < best.low.heightFt)) best = s;
  }
  const score = g.legal ? (best?.score ?? 0) : 0;
  return {
    date: key,
    bidn: beach.bidn,
    speciesId,
    rating: g.legal ? ratingFor(score) : "closed",
    score,
    best,
    gate: g,
    allowedDay,
  };
}

export interface SearchOptions {
  fromKey: string;
  todayKey?: string;
  days?: number;
  minRating?: Rating;
  limit?: number;
}

/**
 * The next days (up to `limit`) rated at least `minRating` for one species at
 * one beach, honoring the user's day-of-week filter.
 */
export function nextIdealDays(
  speciesId: SpeciesId,
  beach: BeachContext,
  tides: readonly TideEvent[],
  prefs: ScoringPrefs = DEFAULT_PREFS,
  opts: SearchOptions,
): DayScore[] {
  const { fromKey, days = 365, minRating = "good", limit = 1 } = opts;
  const todayKey = opts.todayKey ?? fromKey;
  const out: DayScore[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const key = addDays(fromKey, i);
    const s = scoreDay(speciesId, beach, key, tides, prefs, todayKey);
    if (s.allowedDay && RATING_ORDER[s.rating] >= RATING_ORDER[minRating]) out.push(s);
  }
  return out;
}

/** The best-rated species for a beach on one day: drives widgets and notifications. */
export function bestOfDay(
  speciesIds: readonly SpeciesId[],
  beach: BeachContext,
  key: string,
  tides: readonly TideEvent[],
  prefs: ScoringPrefs = DEFAULT_PREFS,
  todayKey: string = key,
): DayScore | null {
  let best: DayScore | null = null;
  for (const id of speciesIds) {
    const s = scoreDay(id, beach, key, tides, prefs, todayKey);
    if (!best || s.score > best.score) best = s;
  }
  return best;
}

const RATING_WORDS: Record<Rating, string> = {
  great: "a great day",
  good: "a good day",
  marginal: "an okay day",
  poor: "not a good day",
  closed: "closed",
};

/** Notification copy, e.g. "Today is a good day for Oysters at Twanoh SP!" */
export function notificationText(s: DayScore, beachName: string, when = "Today"): string {
  const sp = getSpecies(s.speciesId);
  if (s.rating === "closed") return `${sp.plural} are closed at ${beachName} ${when.toLowerCase()}.`;
  return `${when} is ${RATING_WORDS[s.rating]} for ${sp.plural} at ${beachName}!`;
}
