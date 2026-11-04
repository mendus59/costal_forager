import { getSpecies, SPECIES, type SpeciesId } from '@costal-forager/core';
import type { Beach } from './data';

/** Species that can occur at this beach's kind of shore, in table order. */
export function speciesForBeach(beach: Pick<Beach, 'region'>, only?: readonly SpeciesId[]): SpeciesId[] {
  return SPECIES.filter((s) => (s.region === 'both' || s.region === beach.region) && (!only || only.includes(s.id))).map(
    (s) => s.id,
  );
}

export const speciesName = (id: SpeciesId) => getSpecies(id).plural;
