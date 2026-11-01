/**
 * Recreational shellfish species that are harvested by the tide in Washington.
 *
 * Tide heights are feet relative to MLLW. `tideSource` says where the default
 * came from: "wdfw" = a WDFW publication, "estimate" = inferred from where the
 * species lives on the beach (verify before treating as authoritative).
 * Limits are the 2026 WDFW rules. See docs/research.md for sources.
 */

export type SpeciesId =
  | "razor_clam"
  | "geoduck"
  | "horse_clam"
  | "butter_clam"
  | "native_littleneck"
  | "manila_clam"
  | "cockle"
  | "varnish_clam"
  | "softshell_clam"
  | "oyster"
  | "mussel"
  | "goose_barnacle"
  | "sand_shrimp";

/** Which WDFW season on a beach governs this species. */
export type SeasonGroup =
  | "clam" // Puget Sound clam season on that beach (DOH layer Cstartdate/Cenddate)
  | "oyster" // oyster season on that beach (Ostartdate/Oenddate)
  | "mussel" // follows clam season in Puget Sound; Nov 1 to Mar 31 on the coast
  | "razor" // only on WDFW-announced dig days
  | "barnacle" // Puget Sound year-round; Nov 1 to Mar 31 on the coast
  | "year_round";

export type Region = "puget_sound" | "pacific_coast" | "both";

export interface Species {
  id: SpeciesId;
  name: string;
  plural: string;
  /** Low tide at or below this height scores full marks. */
  idealTideFt: number;
  /** Low tide above this height scores zero. */
  marginalTideFt: number;
  tideSource: "wdfw" | "estimate";
  /** Usable harvest window around the low tide, in hours. */
  hoursBeforeLow: number;
  hoursAfterLow: number;
  seasonGroup: SeasonGroup;
  region: Region;
  dailyLimit: string;
  minSize: string | null;
  /** True for species that count toward the combined 40-clam / 10 lb limit. */
  inCombinedClamLimit: boolean;
  isClam: boolean;
  notes: string;
}

export const SPECIES: readonly Species[] = [
  {
    id: "razor_clam",
    name: "Razor clam",
    plural: "Razor clams",
    idealTideFt: -1.0,
    marginalTideFt: 0.5,
    tideSource: "wdfw",
    hoursBeforeLow: 2,
    hoursAfterLow: 0,
    seasonGroup: "razor",
    region: "pacific_coast",
    dailyLimit: "Set per dig (15 to 20 recently); keep the first clams dug",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: true,
    notes:
      "Found from +3 to -2 ft. Best 1 to 2 hours before low. Only on WDFW-announced digs; razor clam license required.",
  },
  {
    id: "geoduck",
    name: "Geoduck",
    plural: "Geoducks",
    idealTideFt: -2.0,
    marginalTideFt: -1.5,
    tideSource: "wdfw",
    hoursBeforeLow: 1,
    hoursAfterLow: 1,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "1 (keep the first dug)",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: true,
    notes: "Buried 2 to 3 ft deep. Exposed only on tides of -2.0 ft or lower, fewer than 20 a year.",
  },
  {
    id: "horse_clam",
    name: "Horse clam",
    plural: "Horse clams",
    idealTideFt: -1.0,
    marginalTideFt: 0.0,
    tideSource: "estimate",
    hoursBeforeLow: 1.5,
    hoursAfterLow: 1.5,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "First 7 dug",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: true,
    notes: "Lower intertidal.",
  },
  {
    id: "butter_clam",
    name: "Butter clam",
    plural: "Butter clams",
    idealTideFt: -0.5,
    marginalTideFt: 1.5,
    tideSource: "wdfw",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: "1.5 in",
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Holds PSP biotoxin for long periods; always check DOH status.",
  },
  {
    id: "native_littleneck",
    name: "Native littleneck",
    plural: "Native littlenecks",
    idealTideFt: -0.5,
    marginalTideFt: 1.5,
    tideSource: "wdfw",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: "1.5 in",
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Mid intertidal, gravel.",
  },
  {
    id: "manila_clam",
    name: "Manila clam",
    plural: "Manila clams",
    idealTideFt: 1.0,
    marginalTideFt: 2.5,
    tideSource: "estimate",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: "1.5 in",
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Upper to mid intertidal; often productive on marginal tides.",
  },
  {
    id: "cockle",
    name: "Cockle",
    plural: "Cockles",
    idealTideFt: -0.5,
    marginalTideFt: 1.5,
    tideSource: "wdfw",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: "2.5 in",
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Low intertidal, near the surface. Minimum size raised to 2.5 in for 2026.",
  },
  {
    id: "varnish_clam",
    name: "Varnish clam",
    plural: "Varnish clams",
    idealTideFt: 1.5,
    marginalTideFt: 3.0,
    tideSource: "estimate",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: null,
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Upper intertidal. Holds biotoxins for long periods.",
  },
  {
    id: "softshell_clam",
    name: "Eastern softshell",
    plural: "Eastern softshells",
    idealTideFt: 1.0,
    marginalTideFt: 2.5,
    tideSource: "estimate",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "clam",
    region: "puget_sound",
    dailyLimit: "40 clams / 10 lb combined",
    minSize: null,
    inCombinedClamLimit: true,
    isClam: true,
    notes: "Mud flats, upper to mid intertidal.",
  },
  {
    id: "oyster",
    name: "Oyster",
    plural: "Oysters",
    idealTideFt: -0.5,
    marginalTideFt: 1.5,
    tideSource: "wdfw",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "oyster",
    region: "puget_sound",
    dailyLimit: "18; shuck on the beach",
    minSize: "2.5 in",
    inCombinedClamLimit: false,
    isClam: false,
    notes: "Leave shells on the same tideland at the same tide height.",
  },
  {
    id: "mussel",
    name: "Mussel",
    plural: "Mussels",
    idealTideFt: 1.0,
    marginalTideFt: 2.5,
    tideSource: "estimate",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "mussel",
    region: "both",
    dailyLimit: "10 lb in shell",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: false,
    notes: "Blue, California and Mediterranean mussels on rocks and pilings.",
  },
  {
    id: "goose_barnacle",
    name: "Goose barnacle",
    plural: "Goose barnacles",
    idealTideFt: 0.0,
    marginalTideFt: 1.5,
    tideSource: "estimate",
    hoursBeforeLow: 1.5,
    hoursAfterLow: 1.5,
    seasonGroup: "barnacle",
    region: "both",
    dailyLimit: "10 lb whole or 5 lb stalks",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: false,
    notes: "Exposed rocky shores.",
  },
  {
    id: "sand_shrimp",
    name: "Sand shrimp",
    plural: "Sand shrimp",
    idealTideFt: 1.0,
    marginalTideFt: 2.5,
    tideSource: "estimate",
    hoursBeforeLow: 2,
    hoursAfterLow: 2,
    seasonGroup: "year_round",
    region: "puget_sound",
    dailyLimit: "10 dozen",
    minSize: null,
    inCombinedClamLimit: false,
    isClam: false,
    notes: "Mud and sand flats; hand or hand-operated suction pump.",
  },
];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: SpeciesId): Species {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

export const CLAM_IDS: readonly SpeciesId[] = SPECIES.filter((s) => s.isClam).map((s) => s.id);

/** The five coastal razor clam management beaches. */
export const RAZOR_CLAM_BEACHES = ["Long Beach", "Twin Harbors", "Copalis", "Mocrocks", "Kalaloch"] as const;
export type RazorClamBeach = (typeof RAZOR_CLAM_BEACHES)[number];
