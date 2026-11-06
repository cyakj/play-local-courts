// Pure calendar helpers for the admin calendar. No React Native imports (runs in Node tests).
// All dates are community-local 'YYYY-MM-DD' strings; never Date objects tied to the device zone.

export const CALENDAR_TIME_ZONE = 'America/Puerto_Rico';

export type EventType = 'community_event' | 'board_meeting' | 'maintenance_scheduled' | 'reservation' | 'blockout';

export interface CalendarEvent {
  id: string;
  hoaId: string;
  community: string;
  type: EventType;
  title: string;
  date: string;          // YYYY-MM-DD (community local)
  startTime: string;     // HH:MM (community local)
  endTime: string | null;
  location: string;
  detail?: string;
  status?: string;
  /** Set only for rows read from hoa_events: those can be cancelled (taken down) by a community administrator. */
  hoaEventId?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;

export function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** Day of week for an ISO date, 0 = Sunday. Pure calendar math (no zone). */
export function dayOfWeek(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addMonths(iso: string, months: number): string {
  const { y, m } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
}

export function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

export interface GridCell { date: string; day: number; inMonth: boolean }

/**
 * Month grid as whole weeks (Sunday-first). Always full 7-day rows: leading/trailing cells come
 * from the neighbouring months, so weekdays always align with their dates.
 */
export function buildMonthWeeks(y: number, m1: number): GridCell[][] {
  const first = toIso(y, m1, 1);
  const lead = dayOfWeek(first);
  const total = daysInMonth(y, m1);
  const cellCount = Math.ceil((lead + total) / 7) * 7;
  const start = addDays(first, -lead);
  const weeks: GridCell[][] = [];
  for (let i = 0; i < cellCount; i += 7) {
    weeks.push(Array.from({ length: 7 }, (_, k) => {
      const date = addDays(start, i + k);
      const p = parseIso(date);
      return { date, day: p.d, inMonth: p.y === y && p.m === m1 };
    }));
  }
  return weeks;
}

export function weekOf(iso: string): string[] {
  const start = addDays(iso, -dayOfWeek(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Inclusive list of dates in [from, to], capped so a bad range cannot explode the calendar. */
export function eachDate(from: string, to: string, cap = 400): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < cap) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}

/** Offset (ms) of `zone` from UTC at the instant `utcMs`. */
function zoneOffsetMs(utcMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs;
}

/** A community wall-clock date+time -> the UTC ISO instant it denotes (DST-safe via Intl). */
export function communityWallToIso(date: string, time: string, zone = CALENDAR_TIME_ZONE): string {
  const { y, m, d } = parseIso(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0);
  let utc = guess - zoneOffsetMs(guess, zone);
  utc = guess - zoneOffsetMs(utc, zone); // second pass settles instants near a DST change
  return new Date(utc).toISOString();
}

/** A UTC instant -> the community's wall-clock date and 'HH:MM'. */
export function isoToCommunityWall(iso: string, zone = CALENDAR_TIME_ZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

export function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e); else map.set(e.date, [e]);
  }
  for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title));
  return map;
}

/** Removes duplicate ids (a realtime refetch racing a manual one must never double an entry). */
export function dedupeEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

export function filterEvents(events: CalendarEvent[], opts: { hoaId: string | 'all'; types: ReadonlySet<EventType> | 'all' }): CalendarEvent[] {
  return events.filter((e) =>
    (opts.hoaId === 'all' || e.hoaId === opts.hoaId) && (opts.types === 'all' || opts.types.has(e.type)));
}

/**
 * Expands a (possibly multi-day) blockout into one calendar entry per affected day, clipped to the
 * visible window. Same wall-clock hours each day, matching how the database enforces blockouts.
 */
export function expandBlockout(b: {
  id: string; hoaId: string; community: string; courtName: string; date: string; endDate: string | null;
  startTime: string; endTime: string; description: string | null;
}, window: { from: string; to: string }): CalendarEvent[] {
  const last = b.endDate && b.endDate > b.date ? b.endDate : b.date;
  const from = b.date > window.from ? b.date : window.from;
  const to = last < window.to ? last : window.to;
  if (from > to) return [];
  return eachDate(from, to).map((date) => ({
    id: `blockout-${b.id}-${date}`,
    hoaId: b.hoaId, community: b.community, type: 'blockout' as const,
    title: `${b.courtName} blocked${b.description ? `: ${b.description}` : ''}`,
    date, startTime: b.startTime.slice(0, 5), endTime: b.endTime.slice(0, 5), location: b.courtName,
  }));
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  community_event: 'Community event',
  board_meeting: 'Board meeting',
  maintenance_scheduled: 'Maintenance',
  reservation: 'Reservation',
  blockout: 'Blockout',
};

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m || 0)} ${suffix}`;
}

/** Only real community events (hoa_events rows) can be cancelled from the calendar; reservations and closures have their own screens. */
export const canCancelEvent = (e: CalendarEvent): boolean => !!e.hoaEventId && e.type !== 'reservation' && e.type !== 'blockout';
