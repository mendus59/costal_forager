/**
 * Builds the home-screen widget's content: the best day rating across the
 * user's favorite beaches and species, one entry per local day for a week.
 */
import {
  addDays,
  bestOfDay,
  localDateKey,
  RATING_ORDER,
  zonedTime,
  type DayScore,
  type ScoringPrefs,
  type SpeciesId,
  type TideEvent,
} from '@costal-forager/core';

import { RatingColors } from '@/constants/Colors';
import { EMPTY_WIDGET, type DayQualityProps } from '@/widgets/types';
import { toContext, type Beach } from './data';
import { fmtDay, fmtFt, fmtTime } from './format';
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
