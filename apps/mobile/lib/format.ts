import { WA_TZ } from '@costal-forager/core';

const time = new Intl.DateTimeFormat('en-US', { timeZone: WA_TZ, hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

export const fmtTime = (d: Date) => time.format(d);

/** "Sat, Nov 7" for a "YYYY-MM-DD" key. */
export const fmtDay = (key: string) => day.format(new Date(`${key}T12:00:00Z`));

export const fmtFt = (ft: number) => `${ft > 0 ? '+' : ''}${ft.toFixed(1)} ft`;

/** "10:00 AM" for minutes after midnight. */
export function fmtMinutes(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  const min = mm % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function relativeDay(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today';
  const diff = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return fmtDay(key);
}
