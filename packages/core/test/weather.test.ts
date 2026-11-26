import { describe, expect, it } from "vitest";
import { compassDir, parseWeather, weatherAt, weatherLabel, weatherUrl } from "../src/index.ts";

// Shaped like an Open-Meteo response for weatherUrl() (timeformat=unixtime, timezone=America/Los_Angeles).
// 1795680000 = 2026-11-26T08:00:00Z = midnight Nov 26 in Washington (PST).
const MIDNIGHT = 1795680000;
const sample = {
  current: {
    time: MIDNIGHT + 10 * 3600 + 900,
    temperature_2m: 47.3,
    weather_code: 61,
    is_day: 1,
    wind_speed_10m: 12.4,
    wind_gusts_10m: 21.0,
    wind_direction_10m: 225,
  },
  hourly: {
    time: [MIDNIGHT + 9 * 3600, MIDNIGHT + 10 * 3600, MIDNIGHT + 11 * 3600],
    temperature_2m: [46, 47, 48],
    weather_code: [3, 61, 63],
    is_day: [1, 1, 1],
    wind_speed_10m: [10, 12, null],
    wind_gusts_10m: [18, 21, 25],
    wind_direction_10m: [200, 225, 240],
    precipitation_probability: [20, 60, 80],
  },
  daily: {
    time: [MIDNIGHT, MIDNIGHT + 86400],
    weather_code: [63, 2],
    temperature_2m_max: [50, 52],
    temperature_2m_min: [40, 38],
    wind_speed_10m_max: [18, 8],
    wind_gusts_10m_max: [30, 15],
    wind_direction_10m_dominant: [220, 340],
    precipitation_probability_max: [90, 10],
  },
};

describe("weather", () => {
  it("builds an Open-Meteo URL in Fahrenheit, mph and Washington days", () => {
    const u = new URL(weatherUrl(47.61234, -122.34567));
    expect(u.searchParams.get("latitude")).toBe("47.61");
    expect(u.searchParams.get("longitude")).toBe("-122.35");
    expect(u.searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(u.searchParams.get("wind_speed_unit")).toBe("mph");
    expect(u.searchParams.get("timezone")).toBe("America/Los_Angeles");
  });

  it("parses now, hours and days", () => {
    const w = parseWeather(sample);
    expect(w.now).toMatchObject({ tempF: 47.3, code: 61, windMph: 12.4, gustMph: 21, windDeg: 225, isDay: true });
    expect(w.hours).toHaveLength(3);
    expect(w.hours[2].windMph).toBe(0); // null becomes 0
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-26", "2026-11-27"]);
    expect(w.days[0]).toMatchObject({ highF: 50, lowF: 40, windMph: 18, gustMph: 30, precipPct: 90 });
  });

  it("throws on an API error", () => {
    expect(() => parseWeather({ error: true, reason: "limit" })).toThrow(/limit/);
  });

  it("finds the hour containing a time", () => {
    const { hours } = parseWeather(sample);
    expect(weatherAt(hours, new Date((MIDNIGHT + 10.5 * 3600) * 1000))?.tempF).toBe(47);
    expect(weatherAt(hours, new Date((MIDNIGHT + 8 * 3600) * 1000))).toBeNull();
    expect(weatherAt(hours, new Date((MIDNIGHT + 13 * 3600) * 1000))).toBeNull();
  });

  it("names compass directions", () => {
    expect(compassDir(0)).toBe("N");
    expect(compassDir(359)).toBe("N");
    expect(compassDir(225)).toBe("SW");
    expect(compassDir(100)).toBe("E");
    expect(compassDir(-90)).toBe("W");
  });

  it("labels weather codes", () => {
    expect(weatherLabel(0)).toEqual({ label: "Clear", icon: "☀️" });
    expect(weatherLabel(0, false).icon).toBe("🌙");
    expect(weatherLabel(63, false).icon).toBe("🌧️");
    expect(weatherLabel(1234).label).toBe("Unknown");
  });
});
