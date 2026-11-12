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

/** A coming high or low for the Android layout, which picks the next ones when it renders. */
export interface WidgetTide {
  /** When, in ms since the epoch. */
  t: number;
  high: boolean;
  /** Local midnight starting its day, in ms: the layout leaves the weekday off when now is past it. */
  dayStart: number;
  /** "3:12 PM", "Tue 3:12 AM", "3:12p", "Tu 3:12a", "+11.2 ft" */
  time: string;
  dayTime: string;
  short: string;
  dayShort: string;
  ft: string;
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
  /**
   * Android: the charts' time window in ms. The charts have no "now" line;
   * the layout draws it from the time it renders, so it stays current
   * between app updates.
   */
  chartFrom: number;
  chartTo: number;
  /** Android: the highs and lows over the next 3 days. */
  upcoming: WidgetTide[];
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
  chartFrom: 0,
  chartTo: 0,
  upcoming: [],
  curve: [],
  turns: [],
  nowX: 0,
  note: 'Tap to open Coastal Forager and pick a beach.',
  url: 'coastalforager://settings',
};

/**
 * How the Android widget lays itself out at a size (in dp), following
 * TideWidget: 1 to 3 columns of detail across. At 3 columns and 1 row (3x1)
 * the times sit on the left and a small tide chart on the right; from 2 rows
 * tall the chart sits under the times, at most half as tall as it is wide so
 * it never looks stretched. The layout function repeats this math (it can't
 * import it), and the app uses it to draw the chart at the size it is shown.
 */
export function widgetGeometry(widthDp: number, heightDp: number, hasSub: boolean) {
  const cols = widthDp >= 180 ? 3 : widthDp >= 110 ? 2 : 1;
  const rows = heightDp >= 100 ? 2 : 1;
  const inline = cols === 3 && rows === 1;
  const pad = inline ? 8 : cols === 1 || rows === 1 ? 6 : 10;
  if (inline) {
    const chartW = Math.floor(widthDp - 2 * (pad + 2) - INLINE_TEXT_W - 6);
    const chartH = Math.floor(heightDp - 2 * pad);
    const ok = chartW >= 40 && chartH >= 24;
    return { cols, rows, inline, pad, chartW: ok ? chartW : 0, chartH: ok ? chartH : 0 };
  }
  const header = cols === 3 ? 56 + (hasSub ? 14 : 0) : cols === 2 ? 50 : 46;
  const chartW = Math.floor(widthDp - 2 * (pad + 2));
  const room = rows === 2 ? Math.floor(heightDp - 2 * pad - header - 4) : 0;
  const chartH = Math.min(room, Math.floor(chartW / 2));
  return { cols, rows, inline, pad, chartW, chartH: chartH >= 20 ? chartH : 0 };
}

/** Width of the times column in the 3x1 layout. */
export const INLINE_TEXT_W = 148;

/**
 * Chart shapes always drawn as [width:height ratio, height in dp], besides
 * the exact one for the widget's last known size: a small one for 3x1 and a
 * few for taller widgets. The layout shows the closest one scaled to fit, so
 * a mismatch leaves a little space rather than stretching the chart.
 */
export const CHART_SHAPES: [number, number][] = [
  [1.4, 54],
  [1.8, 54],
  [2, 110],
  [2.6, 100],
  [3.4, 80],
];
