/**
 * Washington Department of Health "Recreational Shellfish Beaches" layer.
 * Metadata: https://services8.arcgis.com/rGGrs6HCnw87OFOT/ArcGIS/rest/services/Recreational_Shellfish_Beaches/FeatureServer/info/metadata
 *
 * One polyline feature per monitored public beach. DOH updates it hourly
 * when anything changes, combining its health closures with WDFW seasons.
 * Health closures override seasons. Not every public beach is included, so a
 * beach missing from this layer is "unknown", never "safe".
 */
import { CLAM_IDS, type SpeciesId } from "./species.ts";
import type { LatLng } from "./geo.ts";

export const DOH_BEACHES_LAYER =
  "https://services8.arcgis.com/rGGrs6HCnw87OFOT/ArcGIS/rest/services/Recreational_Shellfish_Beaches/FeatureServer/0";
export const DOH_SAFETY_MAP = "https://doh.wa.gov/shellfishsafety";
export const DOH_HOTLINE = "1-800-562-5632";
/** The layer's maxRecordCount. */
export const DOH_PAGE_SIZE = 2000;

export type DohStatus = "open" | "closed" | "conditional" | "unclassified" | "unknown";

export interface DateRange {
  /** Inclusive "YYYY-MM-DD" bounds. */
  start: string;
  end: string;
}

export interface DohBeach {
  bidn: string;
  dohBeachId: number | null;
  name: string;
  waterbody: string | null;
  county: string | null;
  growingArea: string | null;
  owner: string | null;
  infoLink: string | null;
  /** Combined DOH + WDFW status (FINALSTATUS). */
  status: DohStatus;
  /** Health-only status (PopupStatus). */
  healthStatus: DohStatus;
  /** Species closed by health order. "all" when every species is closed. */
  closedFor: SpeciesId[] | "all";
  closedForText: string;
  /** Pollution classification (Open / Closed / Unclassified). */
  classification: string | null;
  advisory: string | null;
  emergency: string | null;
  message: string | null;
  vibrio: boolean;
  /** WDFW season flag: 0 closed, 1 open, 2 open for some species. */
  wdfwOpen: 0 | 1 | 2 | null;
  seasonText: string;
  clamSeason: DateRange | null;
  oysterSeason: DateRange | null;
  midpoint: LatLng | null;
  /** WGS84 polyline paths, when queried with outSR=4326. */
  paths: [number, number][][];
  updatedAt: Date | null;
}

/** Query URL for one page of beaches, in WGS84. */
export function dohQueryUrl(offset = 0, where = "1=1"): string {
  const q = new URLSearchParams({
    where,
    outFields: "*",
    outSR: "4326",
    returnGeometry: "true",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: String(DOH_PAGE_SIZE),
    f: "json",
  });
  return `${DOH_BEACHES_LAYER}/query?${q}`;
}

export function parseStatus(raw: unknown): DohStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "open") return "open";
  if (s === "closed") return "closed";
  if (s.startsWith("conditional")) return "conditional";
  if (s === "unclassified") return "unclassified";
  return "unknown";
}

const SPECIFIC_CLAMS: [RegExp, SpeciesId][] = [
  [/razor/, "razor_clam"],
  [/geoduck/, "geoduck"],
  [/horse/, "horse_clam"],
  [/butter/, "butter_clam"],
  [/littleneck/, "native_littleneck"],
  [/manila/, "manila_clam"],
  [/cockle/, "cockle"],
  [/varnish/, "varnish_clam"],
  [/softshell|soft-shell|soft shell/, "softshell_clam"],
];

/**
 * Map DOH's free-text "closed for" list to species ids. Species DOH lists that
 * this app does not track (e.g. "Scallops") map to nothing.
 */
export function parseClosedFor(raw: unknown): SpeciesId[] | "all" {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s || s === "none") return [];
  if (/all species/.test(s)) return "all";
  const out = new Set<SpeciesId>();
  let namedClam = false;
  for (const [re, id] of SPECIFIC_CLAMS) {
    if (re.test(s)) {
      out.add(id);
      namedClam = true;
    }
  }
  // A bare "clams" with no specific species named closes every clam except
  // razor clams, which DOH always names explicitly.
  if (!namedClam && /\bclams?\b/.test(s)) {
    for (const id of CLAM_IDS) if (id !== "razor_clam") out.add(id);
  }
  if (/oyster/.test(s)) out.add("oyster");
  if (/mussel/.test(s)) out.add("mussel");
  if (/barnacle/.test(s)) out.add("goose_barnacle");
  if (/shrimp/.test(s)) out.add("sand_shrimp");
  return [...out];
}

/** Epoch ms (UTC midnight) to "YYYY-MM-DD". */
function epochToKey(ms: unknown): string | null {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString().slice(0, 10);
}

function range(start: unknown, end: unknown): DateRange | null {
  const s = epochToKey(start);
  const e = epochToKey(end);
  return s && e ? { start: s, end: e } : null;
}

export function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function text(s: unknown): string | null {
  const t = stripHtml(s);
  return t ? t : null;
}

/** "POTLATCH SP" -> "Potlatch SP"; keeps short all-caps tokens like SP, DNR. */
export function titleCaseBeach(name: string): string {
  const keep = new Set(["SP", "DNR", "NAS", "WDFW", "ONP", "NWR", "MP", "II", "III"]);
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (keep.has(w) || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

interface RawFeature {
  attributes: Record<string, unknown>;
  geometry?: { paths?: number[][][] };
}

export function parseDohFeature(f: RawFeature): DohBeach {
  const a = f.attributes;
  const midx = Number(a.Midx);
  const midy = Number(a.Midy);
  const dfw = Number(a.DFWOpen);
  const updated = Number(a.UPDATED);
  const seasonText = [stripHtml(a.Cseason), stripHtml(a.Oseason)].filter(Boolean).join(" ");
  return {
    bidn: String(a.BIDN ?? "").trim(),
    dohBeachId: a.BEACHID == null ? null : Number(a.BEACHID),
    name: titleCaseBeach(String(a.BEACHNAME ?? "")),
    waterbody: text(a.WATERBODYNAME),
    county: text(a.COUNTYNAME),
    growingArea: text(a.GROWINGAREANAME),
    owner: text(a.ORGANIZATION),
    infoLink: text(a.LINK),
    status: parseStatus(a.FINALSTATUS),
    healthStatus: parseStatus(a.PopupStatus),
    closedFor: parseClosedFor(a.PopupClosedFor),
    closedForText: stripHtml(a.PopupClosedFor),
    classification: text(a.CLASSIFICATION),
    advisory: text(a.REASONDESCRIPTION),
    emergency: text(a.PopupEmergency),
    message: text(a.PopupMessage),
    vibrio: String(a.Vibrio ?? "").toLowerCase() === "yes",
    wdfwOpen: dfw === 0 || dfw === 1 || dfw === 2 ? dfw : null,
    seasonText,
    clamSeason: range(a.Cstartdate, a.Cenddate),
    oysterSeason: range(a.Ostartdate, a.Oenddate),
    midpoint: Number.isFinite(midx) && Number.isFinite(midy) && midx !== 0 ? { lat: midy, lng: midx } : null,
    paths: (f.geometry?.paths ?? []).map((p) => p.map(([x, y]) => [x, y] as [number, number])),
    updatedAt: Number.isFinite(updated) && updated > 0 ? new Date(updated) : null,
  };
}

interface RawQuery {
  features?: RawFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

export function parseDohQuery(json: unknown): { beaches: DohBeach[]; more: boolean } {
  const body = json as RawQuery;
  if (body.error) throw new Error(`DOH ArcGIS error: ${body.error.message ?? "unknown"}`);
  const beaches = (body.features ?? []).map(parseDohFeature).filter((b) => b.bidn);
  return { beaches, more: Boolean(body.exceededTransferLimit) };
}

/**
 * Open-ocean beaches vs. inland waters (Puget Sound, Hood Canal, the Strait,
 * Grays Harbor, Willapa Bay). Heuristic: a razor clam area name or an ocean
 * waterbody name in the DOH record.
 */
export function regionOf(b: Pick<DohBeach, "name" | "waterbody">): "puget_sound" | "pacific_coast" {
  const text = `${b.name} ${b.waterbody ?? ""}`;
  return /pacific|ocean|long beach|twin harbors|copalis|mocrocks|kalaloch/i.test(text) ? "pacific_coast" : "puget_sound";
}

/** A representative point for the beach: the DOH midpoint, else the middle vertex. */
export function beachPoint(b: DohBeach): LatLng | null {
  if (b.midpoint) return b.midpoint;
  const path = b.paths[0];
  if (!path?.length) return null;
  const [lng, lat] = path[Math.floor(path.length / 2)];
  return { lat, lng };
}
