/**
 * Parsers for WDFW pages that have no API.
 *
 * - Beach pages, https://wdfw.wa.gov/places-to-go/shellfish-beaches/{BIDN},
 *   carry a free-text "Harvest profile" describing which species are common.
 * - Razor clam digs are announced about a week ahead on
 *   https://wdfw.wa.gov/fishing/shellfishing-regulations/razor-clams and in
 *   news releases, one line per day.
 *
 * Both parsers work on plain text so they survive markup changes; callers
 * strip HTML first with `htmlToText`.
 */
import { RAZOR_CLAM_BEACHES, type RazorClamBeach, type SpeciesId } from "./species.ts";
import { zonedTime, pad } from "./time.ts";

export const WDFW_BEACH_PAGE = (bidn: string) => `https://wdfw.wa.gov/places-to-go/shellfish-beaches/${bidn}`;
export const WDFW_RAZOR_PAGE = "https://wdfw.wa.gov/fishing/shellfishing-regulations/razor-clams";

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Harvest profile

export type Abundance = "abundant" | "present" | "scarce" | "absent";

const SPECIES_WORDS: [RegExp, SpeciesId][] = [
  [/\bgeoducks?\b/i, "geoduck"],
  [/\bhorse clams?\b/i, "horse_clam"],
  [/\bbutter clams?\b/i, "butter_clam"],
  [/\b(native )?littlenecks?\b/i, "native_littleneck"],
  [/\bmanilas?( clams?)?\b/i, "manila_clam"],
  [/\bcockles?\b/i, "cockle"],
  [/\bvarnish clams?\b/i, "varnish_clam"],
  [/\b(eastern )?soft-?shell( clams?)?\b/i, "softshell_clam"],
  [/\boysters?\b/i, "oyster"],
  [/\bmussels?\b/i, "mussel"],
];

const NEGATIVE = /\b(not expected|not (?:very )?common|no |none|absent|not present|lacks?)\b/i;
const SCARCE = /\b(few|scarce|sparse|limited|low (?:numbers|densit)|uncommon|not abundant|small numbers)\b/i;
const ABUNDANT = /\b(abundant|plentiful|excellent|very good|high densit|numerous|dense)\b/i;

/**
 * Pull species abundance out of a WDFW "Harvest profile" paragraph.
 * Each sentence is judged on its own, and only species it names are scored.
 * When a species is mentioned more than once, the most positive reading wins.
 */
export function parseHarvestProfile(text: string): Partial<Record<SpeciesId, Abundance>> {
  const rank: Record<Abundance, number> = { absent: 0, scarce: 1, present: 2, abundant: 3 };
  const out: Partial<Record<SpeciesId, Abundance>> = {};
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    let level: Abundance = "present";
    if (NEGATIVE.test(sentence)) level = "absent";
    else if (SCARCE.test(sentence)) level = "scarce";
    else if (ABUNDANT.test(sentence)) level = "abundant";
    for (const [re, id] of SPECIES_WORDS) {
      if (!re.test(sentence)) continue;
      const prev = out[id];
      if (!prev || rank[level] > rank[prev]) out[id] = level;
    }
  }
  return out;
}

/** The "Harvest profile" section of a beach page's text, if present. */
export function extractHarvestProfile(pageText: string): string | null {
  const m = /Harvest profile\s*\n?([\s\S]*?)(?:\n(?:Directions|Beach map|Seasons?|Regulations|Health)\b|$)/i.exec(pageText);
  const body = m?.[1]?.trim();
  return body ? body : null;
}

// ---------------------------------------------------------------------------
// Razor clam digs

export interface RazorDig {
  /** Local date "YYYY-MM-DD". */
  date: string;
  beaches: RazorClamBeach[];
  lowTime: Date | null;
  lowTideFt: number | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const DATE_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i;
const TIME_RE = /\b(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i;
const HEIGHT_RE = /(?:^|[\s;,(])([-+]?\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\b/i;

function beachesIn(line: string): RazorClamBeach[] {
  return RAZOR_CLAM_BEACHES.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(line));
}

/**
 * Parse dig days from announcement text. Accepts the formats WDFW uses, e.g.
 *   "Monday, Oct. 26: Mocrocks only, low tide 7:18 p.m., -1.2 ft"
 *   "Oct. 26, Monday, 7:18 p.m.; -1.2 feet; Mocrocks"
 * Lines without a date and at least one razor clam beach are ignored.
 * The year is taken from `reference` (the announcement date): a month more
 * than 2 months before the reference month rolls into the next year.
 */
export function parseRazorDigs(text: string, reference: Date): RazorDig[] {
  const refYear = reference.getUTCFullYear();
  const refMonth = reference.getUTCMonth() + 1;
  const digs: RazorDig[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    const d = DATE_RE.exec(line);
    const beaches = beachesIn(line);
    if (!d || beaches.length === 0) continue;
    const month = MONTHS[d[1].toLowerCase()];
    const day = Number(d[2]);
    const year = month < refMonth - 2 ? refYear + 1 : refYear;
    const date = `${year}-${pad(month)}-${pad(day)}`;

    let lowTime: Date | null = null;
    const t = TIME_RE.exec(line);
    if (t) {
      let h = Number(t[1]) % 12;
      if (t[3].toLowerCase() === "p") h += 12;
      lowTime = zonedTime(date, h * 60 + Number(t[2]));
    }
    const h = HEIGHT_RE.exec(line);
    digs.push({ date, beaches, lowTime, lowTideFt: h ? Number(h[1]) : null });
  }
  return digs;
}

/** Map a DOH/WDFW beach name to its razor clam management beach, if any. */
export function razorBeachFor(name: string): RazorClamBeach | null {
  return beachesIn(name)[0] ?? null;
}
