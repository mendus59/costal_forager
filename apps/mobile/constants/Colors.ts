import type { Rating } from '@costal-forager/core';

const tintLight = '#0b6e79';
const tintDark = '#5cc8d3';

export default {
  light: {
    text: '#13232b',
    muted: '#5b6b73',
    background: '#f6f8f8',
    card: '#ffffff',
    border: '#dde3e5',
    tint: tintLight,
    tabIconDefault: '#9aa7ad',
    tabIconSelected: tintLight,
  },
  dark: {
    text: '#e8eef0',
    muted: '#9aabb2',
    background: '#0d1518',
    card: '#152126',
    border: '#24343a',
    tint: tintDark,
    tabIconDefault: '#5b6b73',
    tabIconSelected: tintDark,
  },
};

/** Rating colors, chosen to read on both themes; every badge also carries its word. */
export const RatingColors: Record<Rating, { bg: string; fg: string; label: string }> = {
  great: { bg: '#1b7f4c', fg: '#ffffff', label: 'Great' },
  good: { bg: '#4f9d3a', fg: '#ffffff', label: 'Good' },
  marginal: { bg: '#d39b1c', fg: '#1d1400', label: 'Marginal' },
  poor: { bg: '#7b8a90', fg: '#ffffff', label: 'Poor' },
  closed: { bg: '#b3362f', fg: '#ffffff', label: 'Closed' },
};

export const StatusColors: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: '#1b7f4c', fg: '#ffffff', label: 'Open' },
  conditional: { bg: '#d39b1c', fg: '#1d1400', label: 'Conditional' },
  unclassified: { bg: '#d39b1c', fg: '#1d1400', label: 'Advisory' },
  closed: { bg: '#b3362f', fg: '#ffffff', label: 'Closed' },
  unknown: { bg: '#7b8a90', fg: '#ffffff', label: 'Unknown' },
};
