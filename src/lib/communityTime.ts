// Community wall-clock time. `bookings.date` / `start_time` / `end_time` are plain
// local values (no zone) — they mean "10:00 at the community", not "10:00 on this
// phone". Each HOA has its own IANA zone (hoas.timezone, migration 20261031100000). Before that migration is applied the
// column does not exist and every community is Puerto Rico (the documented legacy fallback below).
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

/** UTC offset (ms) of `timeZone` at the instant `utcMs`: positive east of Greenwich. */
export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const p = wallParts(new Date(utcMs), timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The real instant (epoch ms) of a zone-less local date + time in `timeZone`. Reservation times are validated by the database
 * so they never fall in a daylight-saving gap or repeated hour; for any other input the first offset that round-trips is used.
 */
export function localToUtcMs(date: string, time: string, timeZone: string): number {
  const wall = wallClockMs(date, time);
  let guess = wall - tzOffsetMs(wall, timeZone);
  guess = wall - tzOffsetMs(guess, timeZone);
  return guess;
}

/**
 * Hours from now until a booking's local start, measured between REAL instants (so a daylight-saving change between now and
 * the start is counted); negative once started.
 */
export function hoursUntilStart(
  date: string,
  startTime: string,
  now: Date = new Date(),
  timeZone = COMMUNITY_TIME_ZONE,
): number {
  return (localToUtcMs(date, startTime, timeZone) - now.getTime()) / 3_600_000;
}

/** "Pacific Time", "Atlantic Standard Time" ... a plain name for a banner such as "All times shown in Pacific Time". */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    return name ?? timeZone;
  } catch { return timeZone; }
}

/** True when the phone is in a different zone from the community right now (offsets differ), so a label is worth showing. */
export function deviceZoneDiffers(timeZone: string, now: Date = new Date()): boolean {
  try {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return !!device && tzOffsetMs(now.getTime(), device) !== tzOffsetMs(now.getTime(), timeZone);
  } catch { return false; }
}

/** Valid IANA zone name (Intl accepts it). */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
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
