/**
 * Choosing what a user's alert says. Pure, so the send-alerts edge function
 * stays thin and this can be tested.
 */
import { bestOfDay, RATING_ORDER, type BeachContext, type DayScore, type Rating, type ScoringPrefs } from "./scoring.ts";
import { getSpecies, SPECIES, type SpeciesId } from "./species.ts";
import type { TideEvent } from "./noaa.ts";
import { WA_TZ } from "./time.ts";

export type AlertKind = "morning" | "evening";

export interface AlertUser {
  favoriteBeaches: string[];
  favoriteSpecies: SpeciesId[];
  prefs: ScoringPrefs;
  minRating: Rating;
}

export interface AlertPick {
  score: DayScore;
  beach: BeachContext;
}

export interface Alert {
  title: string;
  body: string;
  /** Every beach and species that met the bar, best first; all are recorded as sent. */
  picks: AlertPick[];
  /** Beach the notification opens. */
  bidn: string;
}

/** Key for notifications_sent dedupe. */
export const sentKey = (bidn: string, speciesId: string) => `${bidn}:${speciesId}`;

/** Favorite species that live on this kind of shore. */
export function speciesForRegion(region: BeachContext["region"], only: readonly SpeciesId[]): SpeciesId[] {
  return SPECIES.filter((s) => (s.region === "both" || s.region === region) && only.includes(s.id)).map((s) => s.id);
}

const WORDS: Record<Rating, string> = {
  great: "a great day",
  good: "a good day",
  marginal: "an okay day",
  poor: "a poor day",
  closed: "closed",
};

/**
 * The alert for one user and day, or null when nothing meets their bar or
 * everything that does was already sent.
 */
export function pickAlert(
  user: AlertUser,
  beaches: ReadonlyMap<string, BeachContext>,
  tidesFor: (bidn: string) => TideEvent[] | undefined,
  forKey: string,
  todayKey: string,
  kind: AlertKind,
  alreadySent: ReadonlySet<string> = new Set(),
): Alert | null {
  const bar = RATING_ORDER[user.minRating];
  const picks: AlertPick[] = [];
  for (const bidn of user.favoriteBeaches) {
    const beach = beaches.get(bidn);
    const tides = tidesFor(bidn);
    if (!beach || !tides?.length) continue;
    for (const id of speciesForRegion(beach.region, user.favoriteSpecies)) {
      const s = bestOfDay([id], beach, forKey, tides, user.prefs, todayKey);
      if (!s || !s.allowedDay || RATING_ORDER[s.rating] < bar) continue;
      if (alreadySent.has(sentKey(bidn, id))) continue;
      picks.push({ score: s, beach });
    }
  }
  if (picks.length === 0) return null;
  picks.sort((a, b) => b.score.score - a.score.score);

  const top = picks[0];
  const sp = getSpecies(top.score.speciesId);
  const when = kind === "evening" ? "Tomorrow" : "Today";
  const title = `${when} is ${WORDS[top.score.rating]} for ${sp.plural}!`;
  const low = top.score.best?.low;
  const time = low
    ? new Intl.DateTimeFormat("en-US", { timeZone: WA_TZ, hour: "numeric", minute: "2-digit" }).format(low.time)
    : null;
  const height = low ? `${low.heightFt > 0 ? "+" : ""}${low.heightFt.toFixed(1)} ft` : null;
  let body = `${top.beach.name}${low ? `: low ${height} at ${time}` : ""}.`;
  const others = new Set(picks.slice(1).map((p) => p.beach.bidn === top.beach.bidn ? p.score.speciesId : p.beach.bidn));
  if (others.size) body += ` ${others.size} more good ${others.size === 1 ? "pick" : "picks"} in the app.`;
  return { title, body, picks, bidn: top.beach.bidn };
}

/** Prefs from a profiles row. */
export function prefsFromProfile(p: {
  time_window: ScoringPrefs["window"];
  days_of_week: number[] | null;
  tide_overrides: ScoringPrefs["tideOverrides"] | null;
  min_overlap_minutes: number | null;
}): ScoringPrefs {
  return {
    window: p.time_window,
    daysOfWeek: p.days_of_week ?? undefined,
    tideOverrides: p.tide_overrides ?? undefined,
    minOverlapMinutes: p.min_overlap_minutes ?? undefined,
  };
}
