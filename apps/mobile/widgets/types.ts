/**
 * What the home-screen widget shows: one beach and one species the user
 * picked, the next high and low tide, a 24-hour tide chart drawn like
 * TideWidget's (smooth curve, high and low dots, a dashed line at now), and the day's rating as a small
 * colored dot in the corner. Everything is precomputed text, numbers and
 * colors, because widget layouts run in a separate runtime that cannot import
 * app code.
 */
/** A tide chart image for the Android widget, drawn for one width:height ratio. */
export interface TideChartImage {
  /** Width divided by height. */
  a: number;
  /** file:// URI in the widgets directory. */
  uri: string;
}

/** A high or low on the iOS chart: x in curve steps, y from 0 to 1. */
export interface TideTurn {
  x: number;
  y: number;
  high: boolean;
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
  /** Compact next high and low for a 1-column widget: "2:40p", or "Sa 2:40p" when not today. */
  highShort: string;
  lowShort: string;
  /**
   * Android: the tide chart (3 hours back through 21 ahead, TideWidget style)
   * as images for a few width:height ratios; the layout shows the closest one.
   * Added when the widget is published. Empty without tides.
   */
  charts: TideChartImage[];
  /** iOS: water height from 0 to 1 every half hour over the same window. Empty without tides. */
  curve: number[];
  /** iOS: the highs and lows in the window, and where "now" is, in curve steps. */
  turns: TideTurn[];
  nowX: number;
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
  /** TideWidget's colors: red at high tide, blue at low tide. */
  high: '#e03833',
  low: '#2159cc',
  /** Low arrow on the dark card; TideWidget's blue lightened to read on it. */
  lowText: '#5b8ef0',
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
  highShort: '',
  lowShort: '',
  charts: [],
  curve: [],
  turns: [],
  nowX: 0,
  note: 'Tap to open Coastal Forager and pick a beach.',
  url: 'coastalforager://settings',
};

/**
 * How the Android widget lays itself out at a size (in dp), following
 * TideWidget: 1 to 3 columns of detail across, and a tide chart once it is 2
 * rows tall. The layout function repeats this math (it can't import it), and
 * the app uses it to draw the chart at the size it will be shown.
 */
export function widgetGeometry(widthDp: number, heightDp: number, hasSub: boolean) {
  const cols = widthDp >= 180 ? 3 : widthDp >= 110 ? 2 : 1;
  const rows = heightDp >= 100 ? 2 : 1;
  const pad = cols === 1 || rows === 1 ? 6 : 10;
  const header = cols === 3 ? 56 + (hasSub ? 14 : 0) : cols === 2 ? 50 : 46;
  const chartW = widthDp - 2 * (pad + 2);
  const chartH = rows === 2 ? heightDp - 2 * pad - header - 4 : 0;
  return { cols, rows, pad, chartW, chartH: chartH >= 20 ? chartH : 0 };
}

/** The chart ratios always drawn, besides the one for the widget's last known size. */
export const CHART_RATIOS = [2.5, 4, 6];
