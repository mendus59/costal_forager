/**
 * Builds the home-screen widget's content: the best day rating across the
 * user's favorite beaches and species, one entry per local day for a week.
 */
import {
  addDays,
  bestOfDay,
  getSpecies,
  localDateKey,
  RATING_ORDER,
  scoreDay,
  zonedTime,
  type DayScore,
  type ScoringPrefs,
  type SpeciesId,
  type TideEvent,
} from '@costal-forager/core';

import { RatingColors } from '@/constants/Colors';
import { EMPTY_BEACH_TIDE, EMPTY_WIDGET, type BeachTideProps, type DayQualityProps } from '@/widgets/types';
import { toContext, type Beach } from './data';
import { fmtDay, fmtFt, fmtTime, relativeDay } from './format';
import { speciesForBeach, speciesName } from './species';

export interface WidgetInputs {
  favoriteBeaches: string[];
  favoriteSpecies: SpeciesId[];
  prefs: ScoringPrefs;
}

/** At most this many favorite beaches are scored, to keep background work small. */
const MAX_BEACHES = 8;
const DAYS = 7;
const LOOKAHEAD = 21;

type Pick = { score: DayScore; beach: Beach };

export async function buildWidgetEntries(
  input: WidgetInputs,
  beaches: Beach[],
  tidesFor: (stationId: string) => Promise<TideEvent[] | null>,
  now = new Date(),
): Promise<{ date: Date; props: DayQualityProps }[]> {
  const today = localDateKey(now);
  const byId = new Map(beaches.map((b) => [b.bidn, b]));
  const favs = input.favoriteBeaches
    .map((id) => byId.get(id))
    .filter((b): b is Beach => !!b?.station && !!b.location)
    .slice(0, MAX_BEACHES);
  if (favs.length === 0 || input.favoriteSpecies.length === 0) return [{ date: now, props: EMPTY_WIDGET }];

  const ids = [...new Set(favs.map((b) => b.station!.id))];
  const loaded = await Promise.all(ids.map(async (id) => [id, (await tidesFor(id)) ?? []] as const));
  const tides = new Map<string, TideEvent[]>(loaded);

  // Best pick for each day, across favorite beaches.
  const best: (Pick | null)[] = [];
  for (let i = 0; i < LOOKAHEAD; i++) {
    const key = addDays(today, i);
    let pick: Pick | null = null;
    for (const b of favs) {
      const ctx = toContext(b);
      const species = speciesForBeach(b, input.favoriteSpecies);
      if (!ctx || species.length === 0) continue;
      const s = bestOfDay(species, ctx, key, tides.get(b.station!.id)!, input.prefs, today);
      if (
        s &&
        (!pick ||
          s.score > pick.score.score ||
          (s.score === pick.score.score && RATING_ORDER[s.rating] > RATING_ORDER[pick.score.rating]))
      )
        pick = { score: s, beach: b };
    }
    best.push(pick);
  }

  const entries: { date: Date; props: DayQualityProps }[] = [];
  for (let i = 0; i < DAYS; i++) {
    const key = addDays(today, i);
    const pick = best[i];
    const next = best.slice(i + 1).find((p) => p && RATING_ORDER[p.score.rating] >= RATING_ORDER.good);
    entries.push({
      date: i === 0 ? now : zonedTime(key, 0),
      props: toProps(pick, next ?? null),
    });
  }
  return entries;
}

function toProps(pick: Pick | null, next: Pick | null): DayQualityProps {
  const nextText = next ? `Next ${next.score.rating}: ${fmtDay(next.score.date)}` : '';
  if (!pick) return { ...EMPTY_WIDGET, beach: 'No tide data yet', detail: 'Open the app to load tides.', next: nextText };
  const { score, beach } = pick;
  const colors = RatingColors[score.rating];
  const low = score.best?.low;
  const detail =
    score.gate.legal === false
      ? score.gate.reason
      : low
        ? `Low ${fmtFt(low.heightFt)} at ${fmtTime(low.time)}`
        : 'No low tide in your hours';
  return {
    when: 'Today',
    rating: colors.label,
    bg: colors.bg,
    fg: colors.fg,
    species: speciesName(score.speciesId),
    beach: beach.name,
    detail,
    next: nextText,
    url: `coastalforager://beach/${beach.bidn}`,
  };
}

// ---------------------------------------------------------------------------
// "Beach & species" widget: one beach and one species the user picked.

export interface BeachTidePick {
  bidn: string | null;
  species: SpeciesId | null;
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
        props: { ...EMPTY_BEACH_TIDE, species, beach: beach?.name ?? 'Beach not found', low: 'Open the app to load beaches.', url },
      },
    ];
  }
  if (!tides || tides.length === 0) {
    return [{ date: now, props: { ...EMPTY_BEACH_TIDE, species, beach: beach.name, low: 'Open the app to load tides.', url } }];
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
  const best = score.best;
  const over = best && (best.usable ? best.usable.end : best.harvest.end).getTime() <= at.getTime();
  if (score.gate.legal && over) score = scoreDay(speciesId, ctx, addDays(today, 1), tides, prefs, today);

  const rating = score.allowedDay || score.rating === 'closed' ? score.rating : 'poor';
  const colors = RatingColors[rating];
  const low = score.best?.low;
  const lowText =
    score.gate.legal === false
      ? score.gate.reason
      : !score.allowedDay
        ? 'Not one of your days'
        : low && score.best!.usable
          ? `Low ${fmtFt(low.heightFt)} at ${fmtTime(low.time)}`
          : 'No low tide in your hours';

  const nextLow = tides.find((e) => e.type === 'L' && e.time.getTime() > at.getTime());
  const nextDay = nextLow ? localDateKey(nextLow.time) : null;
  // Skip the line when the next low is the one already shown.
  const shown = score.gate.legal && score.allowedDay && score.best?.usable ? low : undefined;
  const nextText = nextLow && nextLow.time.getTime() !== shown?.time.getTime()
    ? `Next low ${nextDay === today ? '' : `${relativeDay(nextDay!, today)} `}${fmtTime(nextLow.time)} (${fmtFt(nextLow.heightFt)})`
    : '';

  return {
    when: relativeDay(score.date, today),
    rating: colors.label,
    bg: colors.bg,
    fg: colors.fg,
    species: speciesName(speciesId),
    beach: beach.name,
    low: lowText,
    next: nextText,
    url: `coastalforager://beach/${beach.bidn}`,
  };
}
