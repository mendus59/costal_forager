/**
 * Builds the home-screen widget's content: one beach and species, colored by
 * the day's rating under the user's preferences, with the low tide time.
 */
import {
  addDays,
  getSpecies,
  localDateKey,
  scoreDay,
  zonedTime,
  type ScoringPrefs,
  type SpeciesId,
  type TideEvent,
} from '@costal-forager/core';

import { RatingColors } from '@/constants/Colors';
import { EMPTY_BEACH_TIDE, type BeachTideProps } from '@/widgets/types';
import { toContext, type Beach } from './data';
import { fmtFt, fmtTime, relativeDay } from './format';
import { speciesForBeach, speciesName } from './species';

export interface WidgetInputs {
  favoriteBeaches: string[];
  favoriteSpecies: SpeciesId[];
  prefs: ScoringPrefs;
}

export interface BeachTidePick {
  bidn: string | null;
  species: SpeciesId | null;
}

/**
 * The beach and species the widget shows: the user's pick, or until they
 * pick one, their first favorite beach with a favorite species found there,
 * so the widget is useful as soon as it is added.
 */
export function effectivePick(
  pick: BeachTidePick | undefined,
  favoriteBeaches: readonly string[],
  favoriteSpecies: readonly SpeciesId[],
  beaches: readonly Beach[],
): BeachTidePick & { auto: boolean } {
  if (pick?.bidn && pick.species) return { ...pick, auto: false };
  const byId = new Map(beaches.map((b) => [b.bidn, b]));
  for (const id of pick?.bidn ? [pick.bidn, ...favoriteBeaches] : favoriteBeaches) {
    const b = byId.get(id);
    if (!b) continue;
    const here = speciesForBeach(b);
    const sp = here.find((s) => favoriteSpecies.includes(s)) ?? here[0];
    if (sp) return { bidn: b.bidn, species: sp, auto: true };
  }
  return { bidn: null, species: null, auto: true };
}

/**
 * The widget's content over the next two days, one entry per moment its text
 * changes (each low tide, the end of each harvest window, each midnight), so
 * iOS can step through them and Android can show the current one.
 */
export function buildBeachTideEntries(
  pick: BeachTidePick,
  prefs: ScoringPrefs,
  beach: Beach | undefined,
  tides: TideEvent[] | null,
  now = new Date(),
): { date: Date; props: BeachTideProps }[] {
  if (!pick.bidn || !pick.species) return [{ date: now, props: EMPTY_BEACH_TIDE }];
  const species = speciesName(pick.species);
  const url = `coastalforager://beach/${pick.bidn}`;
  const ctx = beach ? toContext(beach) : null;
  if (!beach || !ctx) {
    return [
      {
        date: now,
        props: { ...EMPTY_BEACH_TIDE, species, beach: beach?.name ?? 'Beach not found', note: 'Open the app to load beaches.', url },
      },
    ];
  }
  if (!tides || tides.length === 0) {
    return [{ date: now, props: { ...EMPTY_BEACH_TIDE, species, beach: beach.name, note: 'Open the app to load tides.', url } }];
  }

  const until = now.getTime() + 2 * 86400000;
  const times = new Set<number>([now.getTime()]);
  const sp = getSpecies(pick.species);
  for (const e of tides) {
    const t = e.time.getTime();
    if (e.type !== 'L' || t + sp.hoursAfterLow * 3600000 < now.getTime() || t > until) continue;
    if (t > now.getTime()) times.add(t + 60000);
    const end = t + sp.hoursAfterLow * 3600000;
    if (end > now.getTime()) times.add(end + 60000);
  }
  const today = localDateKey(now);
  for (let i = 1; i <= 2; i++) times.add(zonedTime(addDays(today, i), 0).getTime());

  return [...times]
    .filter((t) => t <= until)
    .sort((a, b) => a - b)
    .map((t) => ({ date: new Date(t), props: beachTideAt(pick.species!, beach, ctx, tides, prefs, new Date(t)) }));
}

function beachTideAt(
  speciesId: SpeciesId,
  beach: Beach,
  ctx: NonNullable<ReturnType<typeof toContext>>,
  tides: TideEvent[],
  prefs: ScoringPrefs,
  at: Date,
): BeachTideProps {
  const today = localDateKey(at);
  // Rate today until its best low tide in the user's hours is over, then tomorrow.
  let score = scoreDay(speciesId, ctx, today, tides, prefs, today);
  const todays = score.best;
  const over = todays && (todays.usable ? todays.usable.end : todays.harvest.end).getTime() <= at.getTime();
  if (score.gate.legal && over) score = scoreDay(speciesId, ctx, addDays(today, 1), tides, prefs, today);

  const rating = score.allowedDay || score.rating === 'closed' ? score.rating : 'poor';
  const colors = RatingColors[rating];
  const best = score.gate.legal && score.allowedDay && score.best?.usable ? score.best.low : null;
  const note =
    score.gate.legal === false
      ? score.gate.reason
      : !score.allowedDay
        ? 'Not one of your days'
        : best
          ? ''
          : 'No low tide in your hours';

  // The tide time always shows: the best low in the user's hours on the rated
  // day, or else simply the next low tide from now.
  const low = best ?? tides.find((e) => e.type === 'L' && e.time.getTime() > at.getTime()) ?? null;
  const lowDay = low ? localDateKey(low.time) : null;
  const tideLabel = low
    ? `${lowDay === today ? (best ? 'Best low' : 'Next low') : `${relativeDay(lowDay!, today)} low`} ${fmtFt(low.heightFt)}`
    : 'No tide data';

  return {
    when: relativeDay(score.date, today),
    rating: colors.label,
    bg: colors.bg,
    fg: colors.fg,
    species: speciesName(speciesId),
    beach: beach.name,
    tideTime: low ? fmtTime(low.time) : '--',
    tideLabel,
    note,
    url: `coastalforager://beach/${beach.bidn}`,
  };
}
