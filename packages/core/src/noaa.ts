/**
 * NOAA CO-OPS tide predictions.
 * Data API docs: https://api.tidesandcurrents.noaa.gov/api/prod/
 * Metadata API: https://api.tidesandcurrents.noaa.gov/mdapi/prod/
 *
 * We always request GMT times so instants are unambiguous across DST, and
 * high/low ("hilo") predictions, which subordinate stations also support.
 */

export const NOAA_DATA_API = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
export const NOAA_STATIONS_URL =
  "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
export const APPLICATION = "costal_forager";

export interface TideEvent {
  time: Date;
  heightFt: number;
  type: "H" | "L";
}

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** "R" harmonic (reference) or "S" subordinate. */
  type: string;
  referenceId: string | null;
}

/** "YYYYMMDD" for the NOAA API, from "YYYY-MM-DD". */
export function noaaDate(dateKey: string): string {
  return dateKey.replaceAll("-", "");
}

export function predictionsUrl(stationId: string, beginKey: string, endKey: string): string {
  const q = new URLSearchParams({
    product: "predictions",
    application: APPLICATION,
    begin_date: noaaDate(beginKey),
    end_date: noaaDate(endKey),
    datum: "MLLW",
    station: stationId,
    time_zone: "gmt",
    units: "english",
    interval: "hilo",
    format: "json",
  });
  return `${NOAA_DATA_API}?${q}`;
}

interface RawPredictions {
  predictions?: { t: string; v: string; type: string }[];
  error?: { message: string };
}

/** Parse a hilo predictions response requested with time_zone=gmt. */
export function parsePredictions(json: unknown): TideEvent[] {
  const body = json as RawPredictions;
  if (body.error) throw new Error(`NOAA error: ${body.error.message}`);
  if (!Array.isArray(body.predictions)) throw new Error("NOAA response has no predictions");
  return body.predictions.map((p) => {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(p.t);
    if (!m) throw new Error(`Bad NOAA time: ${p.t}`);
    const time = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    const type = p.type === "H" ? "H" : "L";
    return { time, heightFt: Number(p.v), type };
  });
}

interface RawStations {
  stations: { id: string; name: string; lat: number; lng: number; state: string; type: string; reference_id?: string }[];
}

/** Washington tide-prediction stations from the metadata API. */
export function parseStations(json: unknown, state = "WA"): TideStation[] {
  const body = json as RawStations;
  return body.stations
    .filter((s) => s.state === state)
    .map((s) => ({
      id: String(s.id),
      name: s.name,
      lat: Number(s.lat),
      lng: Number(s.lng),
      type: s.type,
      referenceId: s.reference_id ? String(s.reference_id) : null,
    }));
}

/** Split [begin, end] into chunks of at most `days` days to keep requests small. */
export function dateChunks(beginKey: string, endKey: string, days = 31): [string, string][] {
  const out: [string, string][] = [];
  const toMs = (k: string) => Date.parse(`${k}T00:00:00Z`);
  const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  let start = toMs(beginKey);
  const end = toMs(endKey);
  while (start <= end) {
    const chunkEnd = Math.min(end, start + (days - 1) * 86400000);
    out.push([toKey(start), toKey(chunkEnd)]);
    start = chunkEnd + 86400000;
  }
  return out;
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Fetch all high/low predictions for a station between two dates (inclusive). */
export async function fetchPredictions(
  fetchFn: FetchLike,
  stationId: string,
  beginKey: string,
  endKey: string,
  chunkDays = 31,
): Promise<TideEvent[]> {
  const events: TideEvent[] = [];
  for (const [b, e] of dateChunks(beginKey, endKey, chunkDays)) {
    const res = await fetchFn(predictionsUrl(stationId, b, e));
    if (!res.ok) throw new Error(`NOAA HTTP ${res.status} for station ${stationId}`);
    events.push(...parsePredictions(await res.json()));
  }
  return events;
}
