/**
 * Mapping from the Supabase tables (beaches + beach_status + beach_species)
 * to the shapes the scoring code uses. Shared by the app and edge functions.
 */
import { parseStatus, type DohBeach } from "./doh.ts";
import type { BeachContext } from "./scoring.ts";
import type { RazorClamBeach, SpeciesId } from "./species.ts";

/** Select list for `beaches` that yields a BeachRow. */
export const BEACH_SELECT =
  "bidn, doh_beach_id, name, waterbody, county, growing_area, owner, info_link, region, razor_beach, lat, lng, station_id, station_km, tide_stations(name), beach_status(*), beach_species(species_id, abundance)";

export interface BeachStatusRow {
  status: string;
  health_status: string;
  closed_for: SpeciesId[] | "all";
  closed_for_text: string;
  classification: string | null;
  advisory: string | null;
  emergency: string | null;
  message: string | null;
  vibrio: boolean;
  wdfw_open: 0 | 1 | 2 | null;
  season_text: string;
  clam_season_start: string | null;
  clam_season_end: string | null;
  oyster_season_start: string | null;
  oyster_season_end: string | null;
  doh_updated_at: string | null;
}

export interface BeachRow {
  bidn: string;
  doh_beach_id: number | null;
  name: string;
  waterbody: string | null;
  county: string | null;
  growing_area: string | null;
  owner: string | null;
  info_link: string | null;
  region: "puget_sound" | "pacific_coast";
  razor_beach: RazorClamBeach | null;
  lat: number | null;
  lng: number | null;
  station_id: string | null;
  station_km: number | null;
  tide_stations: { name: string } | null;
  beach_status: BeachStatusRow | null;
  beach_species: { species_id: SpeciesId; abundance: string }[];
}

export interface DigRow {
  dig_date: string;
  razor_beach: RazorClamBeach;
}

const range = (start: string | null, end: string | null) => (start && end ? { start, end } : null);

/** The DOH fields of a beach row. */
export function dohFromRow(r: BeachRow): DohBeach {
  const s = r.beach_status;
  const location = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null;
  return {
    bidn: r.bidn,
    dohBeachId: r.doh_beach_id,
    name: r.name,
    waterbody: r.waterbody,
    county: r.county,
    growingArea: r.growing_area,
    owner: r.owner,
    infoLink: r.info_link,
    status: s ? parseStatus(s.status) : "unknown",
    healthStatus: s ? parseStatus(s.health_status) : "unknown",
    closedFor: s ? s.closed_for : [],
    closedForText: s?.closed_for_text ?? "",
    classification: s?.classification ?? null,
    advisory: s?.advisory ?? null,
    emergency: s?.emergency ?? null,
    message: s?.message ?? null,
    vibrio: s?.vibrio ?? false,
    wdfwOpen: s?.wdfw_open ?? null,
    seasonText: s?.season_text ?? "",
    clamSeason: s ? range(s.clam_season_start, s.clam_season_end) : null,
    oysterSeason: s ? range(s.oyster_season_start, s.oyster_season_end) : null,
    midpoint: location,
    paths: [],
    updatedAt: s?.doh_updated_at ? new Date(s.doh_updated_at) : null,
  };
}

export const digDatesFor = (razorBeach: RazorClamBeach | null, digs: readonly DigRow[]): string[] =>
  razorBeach ? digs.filter((d) => d.razor_beach === razorBeach).map((d) => d.dig_date) : [];

export const absentSpeciesOf = (r: Pick<BeachRow, "beach_species">): SpeciesId[] =>
  (r.beach_species ?? []).filter((x) => x.abundance === "absent").map((x) => x.species_id);

/** Scoring context for a beach row, or null when it has no location. */
export function contextFromRow(r: BeachRow, digs: readonly DigRow[]): BeachContext | null {
  if (r.lat == null || r.lng == null) return null;
  return {
    bidn: r.bidn,
    name: r.name,
    location: { lat: r.lat, lng: r.lng },
    region: r.region,
    doh: r.beach_status ? dohFromRow(r) : null,
    razorBeach: r.razor_beach,
    razorDigDates: digDatesFor(r.razor_beach, digs),
    absentSpecies: absentSpeciesOf(r),
  };
}
