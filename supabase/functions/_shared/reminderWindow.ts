// Pure helpers for send-scheduled-reminders (no Deno or Node imports, so Node tests can import this file directly).
// Reservation date/start_time are zone-less wall-clock values at the COMMUNITY (hoas.timezone). The Edge runtime runs in UTC, so
// `new Date(`${date}T${start}`)` would read them as UTC and fire reminders hours early/late. These helpers convert with the HOA zone.
// Keep tzOffsetMs/localToUtcMs identical to src/lib/communityTime.ts (a test asserts parity).

export const LEGACY_REMINDER_ZONE = 'America/Puerto_Rico';

function wallParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const p = wallParts(new Date(utcMs), timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(utcMs / 1000) * 1000;
}

export function localToUtcMs(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  let guess = wall - tzOffsetMs(wall, timeZone);
  guess = wall - tzOffsetMs(guess, timeZone);
  return guess;
}

export function isUsableZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** The calendar dates (YYYY-MM-DD) a booking could have in ANY zone while its start lies in [windowStart, windowEnd]: UTC date -1 .. +1. */
export function candidateDates(windowStart: Date, windowEnd: Date): string[] {
  const out: string[] = [];
  const day = 86_400_000;
  const first = Math.floor(windowStart.getTime() / day) * day - day;
  const last = Math.floor(windowEnd.getTime() / day) * day + day;
  for (let t = first; t <= last; t += day) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/**
 * The booking's real start instant in its community's zone. A NULL/invalid zone means the community has not chosen one; its
 * reservations are refused by the database, so there is nothing legitimate to remind: returns null (skip, never guess).
 * `legacyServer` (hoas.timezone column absent) uses Puerto Rico, the documented legacy fallback.
 */
export function bookingStartMs(date: string, startTime: string, zone: string | null | undefined, legacyServer = false): number | null {
  const tz = legacyServer ? LEGACY_REMINDER_ZONE : zone;
  if (!isUsableZone(tz)) return null;
  return localToUtcMs(date, startTime, tz);
}

export function inWindow(startMs: number | null, windowStart: Date, windowEnd: Date): boolean {
  return startMs !== null && startMs >= windowStart.getTime() && startMs <= windowEnd.getTime();
}
