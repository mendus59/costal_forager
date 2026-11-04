import { gate, getSpecies, type SpeciesId } from '@costal-forager/core';

import { StatusColors } from '@/constants/Colors';
import { toContext, type Beach } from './data';

/** How a beach looks on the map for the chosen species (or overall, with none). */
export type MapState = 'open' | 'caution' | 'closed' | 'unknown' | 'absent';

export const MAP_STATE_STYLE: Record<Exclude<MapState, 'absent'>, { color: string; label: string }> = {
  open: { color: StatusColors.open.bg, label: 'Open' },
  caution: { color: StatusColors.conditional.bg, label: 'Open with advisory' },
  closed: { color: StatusColors.closed.bg, label: 'Closed' },
  unknown: { color: StatusColors.unknown.bg, label: 'Unknown' },
};

export function mapState(beach: Beach, species: SpeciesId | null, today: string): MapState {
  if (!species) {
    if (beach.status === 'open') return 'open';
    if (beach.status === 'conditional' || beach.status === 'unclassified') return 'caution';
    if (beach.status === 'closed') return 'closed';
    return 'unknown';
  }
  const sp = getSpecies(species);
  if (sp.region !== 'both' && sp.region !== beach.region) return 'absent';
  if (beach.absentSpecies.includes(species)) return 'absent';
  const ctx = toContext(beach);
  if (!ctx) return 'unknown';
  const g = gate(species, ctx, today, today);
  if (!g.legal) return ctx.doh || sp.seasonGroup === 'razor' ? 'closed' : 'unknown';
  // Razor clam digs are opened by WDFW, so the DOH layer's status doesn't apply.
  if (sp.seasonGroup !== 'razor' && (beach.status === 'conditional' || beach.status === 'unclassified')) return 'caution';
  return 'open';
}

export function mapLabel(state: MapState, species: SpeciesId | null): string {
  if (state === 'absent') return 'Not found here';
  const what = species ? getSpecies(species).plural.toLowerCase() : null;
  switch (state) {
    case 'open':
      return what ? `Open for ${what} today` : 'Open today';
    case 'caution':
      return what ? `Open for ${what}, with a DOH advisory` : 'Conditional or advisory';
    case 'closed':
      return what ? `Closed for ${what} today` : 'Closed today';
    default:
      return 'Status unknown; check the DOH safety map';
  }
}
