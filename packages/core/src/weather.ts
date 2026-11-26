/**
 * Weather forecasts from Open-Meteo (https://open-meteo.com/en/docs).
 * Free, no key, CORS enabled, so the app (web too) calls it directly.
 * Data is CC BY 4.0: show "Weather data by Open-Meteo.com" wherever it is used.
 *
 * We ask for Fahrenheit, mph, unix times, and days cut at Washington midnight.
 * Wind direction is where the wind blows FROM, in degrees (0 = north).
 */
import { localDateKey, WA_TZ } from "./time.ts";

export const OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_CREDIT = "https://open-meteo.com/";

export interface WeatherNow {
  time: Date;
  tempF: number;
  code: number;
  isDay: boolean;
  windMph: number;
  gustMph: number;
  windDeg: number;
}

export interface WeatherHour extends WeatherNow {
  /** Chance of precipitation, 0-100. */
  precipPct: number;
}

export interface WeatherDay {
  /** "YYYY-MM-DD", Washington time. */
  date: string;
  code: number;
  highF: number;
  lowF: number;
  windMph: number;
  gustMph: number;
  windDeg: number;
  precipPct: number;
}

export interface Weather {
  now: WeatherNow;
  hours: WeatherHour[];
  days: WeatherDay[];
}

const NOW_VARS = "temperature_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m";

export function weatherUrl(lat: number, lng: number, days = 7): string {
  const q = new URLSearchParams({
    // Two decimals (about 1 km) is plenty and lets nearby beaches share a cache entry.
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    current: NOW_VARS,
    hourly: `${NOW_VARS},precipitation_probability`,
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max," +
      "wind_direction_10m_dominant,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: WA_TZ,
    timeformat: "unixtime",
    forecast_days: String(days),
  });
  return `${OPEN_METEO_API}?${q}`;
}

type Col = (number | null)[];
interface Raw {
  error?: boolean;
  reason?: string;
  current?: Record<string, number | null>;
  hourly?: Record<string, Col>;
  daily?: Record<string, Col>;
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Parse a response requested with weatherUrl(). */
export function parseWeather(json: unknown): Weather {
  const body = json as Raw;
  if (body.error) throw new Error(`Open-Meteo error: ${body.reason ?? "unknown"}`);
  const c = body.current;
  const h = body.hourly;
  const d = body.daily;
  if (!c || !h?.time || !d?.time) throw new Error("Open-Meteo response is missing data");

  const now: WeatherNow = {
    time: new Date(num(c.time) * 1000),
    tempF: num(c.temperature_2m),
    code: num(c.weather_code),
    isDay: c.is_day !== 0,
    windMph: num(c.wind_speed_10m),
    gustMph: num(c.wind_gusts_10m),
    windDeg: num(c.wind_direction_10m),
  };
  const hours: WeatherHour[] = h.time.map((t, i) => ({
    time: new Date(num(t) * 1000),
    tempF: num(h.temperature_2m?.[i]),
    code: num(h.weather_code?.[i]),
    isDay: h.is_day?.[i] !== 0,
    windMph: num(h.wind_speed_10m?.[i]),
    gustMph: num(h.wind_gusts_10m?.[i]),
    windDeg: num(h.wind_direction_10m?.[i]),
    precipPct: num(h.precipitation_probability?.[i]),
  }));
  const days: WeatherDay[] = d.time.map((t, i) => ({
    // Daily times are Washington midnight; noon of that day can't slip across a date line.
    date: localDateKey(new Date((num(t) + 12 * 3600) * 1000)),
    code: num(d.weather_code?.[i]),
    highF: num(d.temperature_2m_max?.[i]),
    lowF: num(d.temperature_2m_min?.[i]),
    windMph: num(d.wind_speed_10m_max?.[i]),
    gustMph: num(d.wind_gusts_10m_max?.[i]),
    windDeg: num(d.wind_direction_10m_dominant?.[i]),
    precipPct: num(d.precipitation_probability_max?.[i]),
  }));
  return { now, hours, days };
}

/** The forecast hour that contains `at`, or null when outside the forecast. */
export function weatherAt(hours: readonly WeatherHour[], at: Date): WeatherHour | null {
  const t = at.getTime();
  let hit: WeatherHour | null = null;
  for (const h of hours) {
    if (h.time.getTime() <= t) hit = h;
    else break;
  }
  return hit && t - hit.time.getTime() < 3600000 ? hit : null;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** "SW" for 225 degrees: the 16-point compass direction the wind comes from. */
export function compassDir(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** WMO weather interpretation codes, as Open-Meteo documents them. */
const CODES: Record<number, [label: string, day: string, night?: string]> = {
  0: ["Clear", "☀️", "🌙"],
  1: ["Mostly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️", "🌧️"],
  81: ["Showers", "🌧️"],
  82: ["Heavy showers", "🌧️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with hail", "⛈️"],
};

/** A short label and an emoji for a WMO weather code. */
export function weatherLabel(code: number, isDay = true): { label: string; icon: string } {
  const hit = CODES[code];
  if (!hit) return { label: "Unknown", icon: "🌡️" };
  return { label: hit[0], icon: !isDay && hit[2] ? hit[2] : hit[1] };
}
