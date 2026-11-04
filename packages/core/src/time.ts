/** Time-zone helpers. All app "days" and user windows are in Washington local time. */

export const WA_TZ = "America/Los_Angeles";

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Intl formatting is slow (especially on Hermes, React Native's engine), and
// scoring asks for local dates thousands of times. Zone offsets only change on
// quarter-hour boundaries, so each zone's offset is looked up once per
// 15-minute bucket and everything else is plain UTC arithmetic.
const BUCKET_MS = 15 * 60000;
const MAX_CACHED = 200000;
const offsetCache = new Map<string, Map<number, number>>();

function intlParts(date: Date, tz: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Zone offset (local minus UTC) in milliseconds at the instant, cached per bucket. */
function offsetMs(t: number, tz: string): number {
  let byBucket = offsetCache.get(tz);
  if (!byBucket) offsetCache.set(tz, (byBucket = new Map()));
  const bucket = Math.floor(t / BUCKET_MS);
  let off = byBucket.get(bucket);
  if (off === undefined) {
    const at = bucket * BUCKET_MS;
    const p = intlParts(new Date(at), tz);
    off = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - at;
    if (byBucket.size >= MAX_CACHED) byBucket.clear();
    byBucket.set(bucket, off);
  }
  return off;
}

export function localParts(date: Date, tz = WA_TZ): LocalParts {
  const t = date.getTime();
  if (!Number.isFinite(t)) return intlParts(date, tz);
  const l = new Date(Math.floor(t / 1000) * 1000 + offsetMs(t, tz));
  return {
    year: l.getUTCFullYear(),
    month: l.getUTCMonth() + 1,
    day: l.getUTCDate(),
    hour: l.getUTCHours(),
    minute: l.getUTCMinutes(),
    second: l.getUTCSeconds(),
  };
}

/** "YYYY-MM-DD" of the instant in the given zone. */
export function localDateKey(date: Date, tz = WA_TZ): string {
  const p = localParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes after local midnight for the instant. */
export function localMinutes(date: Date, tz = WA_TZ): number {
  const p = localParts(date, tz);
  return p.hour * 60 + p.minute + p.second / 60;
}

/** Zone offset (local minus UTC) in minutes at the given instant. */
export function tzOffsetMinutes(date: Date, tz = WA_TZ): number {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * The UTC instant for a local wall-clock time. `minutes` may exceed 1440 to
 * mean a time on a following day (e.g. a window that ends after midnight).
 */
export function zonedTime(dateKey: string, minutes: number, tz = WA_TZ): Date {
  const [y, m, d] = parseDateKey(dateKey);
  const guess = Date.UTC(y, m - 1, d, 0, 0) + minutes * 60000;
  let t = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  // Re-check once in case the guess straddled a DST change.
  t = guess - tzOffsetMinutes(new Date(t), tz) * 60000;
  return new Date(t);
}

export function parseDateKey(key: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Bad date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = parseDateKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday, for a local date key. */
export function dayOfWeek(key: string): number {
  const [y, m, d] = parseDateKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
