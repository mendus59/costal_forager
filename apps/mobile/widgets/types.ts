/**
 * What the home-screen widget shows: one beach and one species the user
 * picked, the next high and low tide, a small 24-hour tide chart (the tide
 * logic comes from the TideWidget project), and the day's rating as a small
 * colored dot in the corner. Everything is precomputed text, numbers and
 * colors, because widget layouts run in a separate runtime that cannot import
 * app code.
 */
export interface TideBar {
  /** Bar height from 0 (lowest water in the window) to 1 (highest). */
  h: number;
  /** Bar color: the current hour, low enough for the species, or plain water. */
  c: string;
}

export interface BeachTideProps {
  /** "Potlatch State Park", or setup text before a beach is picked. */
  beach: string;
  /** "Oysters" */
  species: string;
  /** Rating dot color, and what it means: "Good today", "Closed today". */
  dot: string;
  status: string;
  /** Widget background, text and secondary text colors. */
  bg: string;
  fg: string;
  muted: string;
  /** Next high and low: "3:12 PM" (or "Tue 3:12 AM") and "+11.2 ft". Empty without tides. */
  highTime: string;
  highFt: string;
  lowTime: string;
  lowFt: string;
  /** Hourly bars from 2 hours ago through 21 hours ahead. Empty without tides. */
  bars: TideBar[];
  /** Why the day rates as it does when it isn't usable ("WDFW season closed"), or setup help. */
  note: string;
  /** Deep link the widget opens. */
  url: string;
}

/** Colors for the widget's sea-blue card and its chart. */
export const WIDGET_COLORS = {
  bg: '#0f3340',
  fg: '#ffffff',
  muted: '#a9cbd6',
  water: '#4f9fc0',
  harvest: '#7fd6a0',
  now: '#ffffff',
  noRating: '#7b8a90',
};

export const EMPTY_BEACH_TIDE: BeachTideProps = {
  beach: 'Star a beach',
  species: '',
  dot: WIDGET_COLORS.noRating,
  status: '',
  bg: WIDGET_COLORS.bg,
  fg: WIDGET_COLORS.fg,
  muted: WIDGET_COLORS.muted,
  highTime: '',
  highFt: '',
  lowTime: '',
  lowFt: '',
  bars: [],
  note: 'Tap to open Coastal Forager and pick a beach.',
  url: 'coastalforager://settings',
};
