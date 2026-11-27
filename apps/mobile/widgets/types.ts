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
  /** Height in feet (MLLW), for working out the water level between turns. */
  h: number;
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
  /**
   * The water height now and which way it is going: "+4.2 ft ↑". Empty
   * without tides. Android works it out again from `upcoming` when it renders.
   */
  nowFt: string;
  /** Android: the last high or low before now, then the highs and lows over the next 3 days. */
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
  /**
   * Android: when the refresh button (top-right) was last tapped, in ms. Set
   * by the widget itself, and gone once the app publishes fresh data, so the
   * button shows "…" until then (for at most a minute).
   */
  refreshingAt?: number;
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
  nowFt: '',
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
 * TideWidget: 1 to 3 columns of detail across. At 3 or more columns and under
 * 150 dp tall (3x1, 4x1, and short 2-row cells) the times sit on the left and
 * the tide chart beside them; taller (or 2 columns from 100 dp) the chart sits
 * under the times, below a row for the height-now label, at most 0.6 of its
 * width tall. The header's height is estimated in dp from text sized in sp,
 * so it scales with the phone's text size setting (`fontScale`). Large
 * widgets get slightly bigger text (`scale`). The chart is redrawn for the
 * exact box after a resize, so it fills the box without stretching. The
 * layout function repeats this math (it can't import it), and the app uses it
 * to draw the chart at the size it is shown.
 */
export function widgetGeometry(widthDp: number, heightDp: number, hasSub: boolean, fontScale = 1) {
  const cols = widthDp >= 180 ? 3 : widthDp >= 110 ? 2 : 1;
  const rows = heightDp >= (cols === 3 ? 150 : 100) ? 2 : 1;
  const inline = cols === 3 && rows === 1;
  const scale = widthDp >= 250 && heightDp >= 200 ? 1.2 : 1;
  const pad = inline ? 8 : cols === 1 || rows === 1 ? 6 : 10;
  if (inline) {
    const chartW = Math.floor(widthDp - 2 * (pad + 2) - INLINE_TEXT_W - 6);
    const chartH = Math.min(Math.floor(heightDp - 2 * pad), Math.floor(chartW * 0.8));
    const ok = chartW >= 40 && chartH >= 24;
    return { cols, rows, inline, scale, pad, labelH: 0, chartW: ok ? chartW : 0, chartH: ok ? chartH : 0 };
  }
  if (rows === 1) return { cols, rows, inline, scale, pad, labelH: 0, chartW: 0, chartH: 0 };
  const header = Math.round((cols === 3 ? 60 + (hasSub ? 16 : 0) : cols === 2 ? 52 : 48) * scale * fontScale) + 6;
  const labelH = Math.round(16 * fontScale);
  const chartW = Math.floor(widthDp - 2 * (pad + 2));
  const chartH = Math.min(Math.floor(heightDp - 2 * pad - header - labelH), Math.floor(chartW * 0.6));
  const ok = chartH >= 24;
  return { cols, rows, inline, scale, pad, labelH: ok ? labelH : 0, chartW, chartH: ok ? chartH : 0 };
}

/** Width of the times column in the 3x1 layout. */
export const INLINE_TEXT_W = 148;

/**
 * Chart shapes always drawn as [width:height ratio, height in dp], besides
 * the exact ones for the widget's recent sizes: small ones for 1-row strips
 * and a few for taller widgets. Until the app has redrawn the chart for a new
 * size, the layout shows the closest one scaled to fit, so a mismatch leaves
 * a little space rather than stretching the chart.
 */
export const CHART_SHAPES: [number, number][] = [
  [1.4, 54],
  [1.8, 54],
  [2.8, 54],
  [1.25, 110],
  [1.7, 150],
  [2, 110],
  [2.6, 100],
  [3.4, 80],
];
