/**
 * Builds the home-screen widget's content: one beach and species, its next
 * high and low tide and a small tide chart, with the day's rating under the
 * user's preferences as a colored dot.
 */
import {
  addDays,
  getSpecies,
  localDateKey,
  nextHighAndLow,
  scoreDay,
  tideHeightAt,
  zonedTime,
  type ScoringPrefs,
  type SpeciesId,
  type TideEvent,
} from '@costal-forager/core';

import { RatingColors } from '@/constants/Colors';
import { EMPTY_BEACH_TIDE, WIDGET_COLORS, type BeachTideProps, type TideBar } from '@/widgets/types';
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
 * The widget's content over the next day, one entry per moment it changes
 * (each hour for the chart, each tide turn, the end of each harvest window),
 * so iOS can step through them and Android can show the current one.
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

  const until = now.getTime() + 86400000;
  const times = new Set<number>([now.getTime()]);
  const sp = getSpecies(pick.species);
  for (const e of tides) {
    const t = e.time.getTime();
    if (t + sp.hoursAfterLow * 3600000 < now.getTime() || t > until) continue;
    if (t > now.getTime()) times.add(t + 60000);
    const end = t + sp.hoursAfterLow * 3600000;
    if (e.type === 'L' && end > now.getTime()) times.add(end + 60000);
  }
  for (let h = 1; h <= 24; h++) times.add(Math.floor(now.getTime() / 3600000) * 3600000 + h * 3600000);
  const today = localDateKey(now);
  times.add(zonedTime(addDays(today, 1), 0).getTime());

  return [...times]
    .filter((t) => t <= until)
    .sort((a, b) => a - b)
    .map((t) => ({ date: new Date(t), props: beachTideAt(pick.species!, beach, ctx, tides, prefs, new Date(t)) }));
}

const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' });

/** "3:12 PM" today, else "Tue 3:12 AM". */
function tideTime(e: TideEvent, today: string): string {
  const day = localDateKey(e.time);
  return day === today ? fmtTime(e.time) : `${weekday.format(new Date(`${day}T12:00:00Z`))} ${fmtTime(e.time)}`;
}

/**
 * Hourly bars from 2 hours ago through 21 hours ahead, like TideWidget's
 * graph. Bars at or below the species' marginal tide (low enough to harvest)
 * are green and the current hour is white.
 */
export function tideBars(tides: TideEvent[], at: Date, harvestFt: number): TideBar[] {
  const hour = Math.floor(at.getTime() / 3600000) * 3600000;
  const from = hour - 2 * 3600000;
  const points = Array.from({ length: 24 }, (_, i) => tideHeightAt(tides, new Date(from + i * 3600000)));
  const known = points.filter((h): h is number => h !== null);
  if (known.length < 2) return [];
  const lo = Math.min(...known);
  const hi = Math.max(Math.max(...known), lo + 0.1);
  return points.map((h, i) => ({
    h: h === null ? 0 : (h - lo) / (hi - lo),
    c: i === 2 ? WIDGET_COLORS.now : h !== null && h <= harvestFt ? WIDGET_COLORS.harvest : WIDGET_COLORS.water,
  }));
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

  const { high, low } = nextHighAndLow(tides, at);
  const when = relativeDay(score.date, today);
  return {
    beach: beach.name,
    species: speciesName(speciesId),
    dot: colors.bg,
    status: `${colors.label} ${when === 'Today' || when === 'Tomorrow' ? when.toLowerCase() : `on ${when}`}`,
    bg: WIDGET_COLORS.bg,
    fg: WIDGET_COLORS.fg,
    muted: WIDGET_COLORS.muted,
    highTime: high ? tideTime(high, today) : '--',
    highFt: high ? fmtFt(high.heightFt) : '',
    lowTime: low ? tideTime(low, today) : '--',
    lowFt: low ? fmtFt(low.heightFt) : '',
    bars: tideBars(tides, at, getSpecies(speciesId).marginalTideFt),
    note,
    url: `coastalforager://beach/${beach.bidn}`,
  };
}
