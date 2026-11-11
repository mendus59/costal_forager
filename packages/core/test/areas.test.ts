import { describe, expect, it } from "vitest";
import { areaOutlook, distanceKm, groupAreas, nearestN, parseAllStations, stationLabel, type TideEvent, type UsTideStation } from "../src/index.ts";

// Ported from TideWidget's GeoAreasTest.
const st = (id: string, name: string, lat: number, lng: number, referenceId: string | null = null): UsTideStation => ({
  id, name, state: "CA", lat, lng, referenceId,
});
const sf = st("9414290", "San Francisco", 37.8063, -122.4659);
const alameda = st("9414750", "Alameda", 37.7717, -122.3, "9414290");
const sausalito = st("9414806", "Sausalito", 37.8467, -122.4767, "9414290");
const monterey = st("9413450", "Monterey", 36.605, -121.8883);
const orphan = st("1", "Orphan", 36.0, -121.0, "missing");
const all = [alameda, sf, monterey, sausalito, orphan];

describe("stations and areas (from TideWidget)", () => {
  it("measures and orders by distance", () => {
    expect(distanceKm(sf, monterey)).toBeGreaterThan(138);
    expect(distanceKm(sf, monterey)).toBeLessThan(148);
    expect(nearestN({ lat: 37.7594, lng: -122.5107 }, all, 3).map((n) => n.item.id)).toEqual(["9414290", "9414806", "9414750"]);
  });

  it("groups by reference station, reference first then nearest", () => {
    const areas = new Map(groupAreas(all).map((a) => [a.id, a]));
    expect(areas.size).toBe(3);
    expect(areas.get("9414290")!.stations.map((s) => s.id)).toEqual(["9414290", "9414806", "9414750"]);
    expect(areas.get("1")!.stations.map((s) => s.id)).toEqual(["1"]);
  });

  it("finds the next high and low window across an area", () => {
    const ev = (min: number, type: "H" | "L"): TideEvent => ({ time: new Date(min * 60000), heightFt: 1, type });
    const o = areaOutlook(
      [
        [ev(100, "H"), ev(480, "L")],
        [ev(130, "H"), ev(500, "L")],
        // Already past its high: its next one is the following tide, so it is ignored for highs.
        [ev(470, "L"), ev(850, "H")],
      ],
      new Date(0),
    );
    expect(o.high!.first.time.getTime()).toBe(100 * 60000);
    expect(o.high!.last.time.getTime()).toBe(130 * 60000);
    expect(o.low!.first.time.getTime()).toBe(470 * 60000);
    expect(o.low!.last.time.getTime()).toBe(500 * 60000);
    expect(o.stationsReporting).toBe(3);
  });

  it("parses every station with its state and reference", () => {
    const s = parseAllStations({
      stations: [
        { id: "1610367", name: "Nonopapa", state: "HI", lat: 21.87, lng: -160.235, type: "S", reference_id: "1612340" },
        { id: "1611347", name: "Port Allen", state: "", lat: 21.9, lng: -159.6, type: "R", reference_id: "" },
      ],
    });
    expect(s[0].referenceId).toBe("1612340");
    expect(s[1].referenceId).toBeNull();
    expect(stationLabel(s[0])).toBe("Nonopapa, HI");
    expect(stationLabel(s[1])).toBe("Port Allen");
  });
});
