# Research notes

Full write-up (with beach table and architecture diagram):
<https://claude.ai/artifact/BvJybEHS8Rr7WV8hNkf1zw>. Compiled 2026-11-01.

## Species and tides

The species table, default tide heights and 2026 limits live in
[`packages/core/src/species.ts`](../packages/core/src/species.ts). Heights are
feet relative to MLLW.

- WDFW rates a Puget Sound low of **-0.5 ft or lower** as a good clam and
  oyster tide, and +1.5 to -0.4 ft as marginal. A good tide gives roughly a
  4-hour window around low. ([2026 best tides chart](https://WDFW.WA.GOV/sites/default/files/fishing/shellfishing/WDFWBestClamOysterHarvestTides.pdf))
- Geoduck needs **-2.0 ft or lower**. ([WDFW](https://wdfw.wa.gov/species-habitats/species/panopea-generosa))
- Razor clams live from +3 to -2 ft; dig 1 to 2 hours before low, only on
  announced digs at Long Beach, Twin Harbors, Copalis, Mocrocks and Kalaloch.
  ([WDFW](https://wdfw.wa.gov/fishing/shellfishing-regulations/razor-clams))
- Heights marked `estimate` in `species.ts` are inferred from where each
  species lives on the beach and should be checked against WDFW's intertidal
  clam and oyster handout.
- Closed: pinto abalone; scallops are closed statewide for biotoxins as of
  Nov 2026. Crab, shrimp, octopus and sea cucumbers are not tide-driven and
  are out of scope for now.
- Limits: [WDFW species rules](https://www.eregulations.com/washington/fishing/shellfish-seaweed-species-rules).

## Legal and safe = three checks

1. DOH health status open for the species.
2. WDFW season open on that beach and date.
3. Public tideland (most Puget Sound, Hood Canal, Grays Harbor and Willapa
   tidelands are private).

## Data sources

- **DOH beaches layer** (backbone):
  `https://services8.arcgis.com/rGGrs6HCnw87OFOT/ArcGIS/rest/services/Recreational_Shellfish_Beaches/FeatureServer/0`.
  Polylines, 2000 records a page, updated hourly. Fields used: `BIDN`,
  `BEACHNAME`, `FINALSTATUS`, `PopupStatus`, `PopupClosedFor`,
  `PopupEmergency`, `PopupMessage`, `Vibrio`, `Cstartdate`/`Cenddate`,
  `Ostartdate`/`Oenddate`, `DFWOpen`, `Midx`/`Midy`. Not every public beach is
  included; missing means unknown, not safe.
- **WDFW beach pages**: `https://wdfw.wa.gov/places-to-go/shellfish-beaches/{BIDN}`
  for the harvest profile. HTML only.
- **NOAA CO-OPS**: `api/prod/datagetter` (predictions, MLLW, hilo, gmt) and
  `mdapi/prod/webapi/stations.json?type=tidepredictions`. No key.
- **Sun times**: computed locally.
