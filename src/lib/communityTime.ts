// Community wall-clock time. `bookings.date` / `start_time` / `end_time` are plain
// local values (no zone) — they mean "10:00 at the community", not "10:00 on this
// phone". Every Greens V1 community is in Puerto Rico (America/Puerto_Rico, UTC-4, no
// DST); the schema has no per-HOA timezone yet, so it is a single documented constant
// and the DB enforces the same zone (see the booking approval migration).
//
// Pure functions only (no React Native imports) so they run in plain Node tests.

export const COMMUNITY_TIME_ZONE = 'America/Puerto_Rico';

interface WallParts { y: number; mo: number; d: number; h: number; mi: number; s: number }

function wallParts(now: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date (YYYY-MM-DD) at the community — not the device's or UTC's date. */
export function communityToday(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): string {
  const p = wallParts(now, timeZone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** Wall-clock instant expressed as epoch-ms-in-UTC, so two wall-clock values can be subtracted. */
export function wallClockMs(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s] = time.split(':').map((x) => Number(x));
  return Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
}

export function communityNowMs(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): number {
  const p = wallParts(now, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
}

/** Hours from "now at the community" until a booking's local start (negative once started). */
export function hoursUntilStart(
  date: string,
  startTime: string,
  now: Date = new Date(),
  timeZone = COMMUNITY_TIME_ZONE,
): number {
  return (wallClockMs(date, startTime) - communityNowMs(now, timeZone)) / 3_600_000;
}

export function formatDuration(hours: number): string {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
  if (h > 0) return `${h} h${m ? ` ${m} min` : ''}`;
  return `${m} min`;
}

/** Minutes since midnight at the community (not the device). */
export function communityMinutesNow(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): number {
  const p = wallParts(now, timeZone);
  return p.h * 60 + p.mi;
}
