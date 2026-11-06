// Pure helpers for the resident Schedule. No React / Supabase: unit tested in Node.
//
// Everything on the Schedule is shown as COMMUNITY wall-clock time ("10:00 at the community"), matching how reservations are
// stored (zone-less date + time). Timestamptz events are converted to that wall clock with the community's IANA zone.

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant as zone-less `YYYY-MM-DDTHH:mm:ss` wall-clock time in `timeZone` (device zone when the zone is unknown/invalid). */
export function toWallClockIso(iso: string, timeZone: string | null | undefined): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let tz = timeZone || undefined;
  try { if (tz) new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = undefined; }
  if (!tz) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}`;
}

/** Statuses of the resident's OWN reservations that belong on a calendar. cancelled / expired / denied / rejected do not. */
export const CALENDAR_BOOKING_STATUSES = ['confirmed', 'pending'] as const;

export function reservationTitle(courtName: string, startHHMM: string, endHHMM: string, status: string, fmt: (hhmm: string) => string): string {
  const base = `${courtName} · ${fmt(startHHMM)} – ${fmt(endHHMM)}`;
  return status === 'pending' ? `${base} · Pending approval` : base;
}

export interface MaintenanceRow {
  id: string;
  date: string;               // YYYY-MM-DD (first day)
  end_date: string | null;    // YYYY-MM-DD (last day) for a multi-day closure
  start_time: string;         // HH:MM[:SS]
  end_time: string;
  description: string | null;
  courts: { name: string; hoa_id: string } | null;
}

export interface ScheduleItem {
  id: string; title: string; event_type: string; location: string | null; starts_at: string;
  hoa_id: string; community_name: string; description: string | null;
}

/** Days materialised per closure, counted from the first day that is not in the past (so a long ongoing closure still shows now). */
const MAX_CLOSURE_DAYS = 120;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Planned closures / maintenance windows (court_maintenance, which the booking system already enforces as blockouts) as Schedule
 * items, one per calendar day so each day of a multi-day closure is marked. This is the SHARED model: the same row blocks booking
 * and appears here. Individual maintenance REPORTS (maintenance_reports) are private to the reporter and never appear.
 * `fromDate` (YYYY-MM-DD) drops days that ended before it.
 */
export function maintenanceToItems(rows: MaintenanceRow[], hoaNames: Map<string, string>, fromDate: string): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (const r of rows) {
    if (!r.courts || !r.date) continue;
    const last = r.end_date && r.end_date >= r.date ? r.end_date : r.date;
    const first = r.date < fromDate ? fromDate : r.date;
    for (let i = 0, day = first; day <= last && i < MAX_CLOSURE_DAYS; i++, day = addDays(first, i)) {
      const start = r.start_time.slice(0, 5);
      const end = r.end_time.slice(0, 5);
      out.push({
        id: `closure-${r.id}-${day}`,
        title: `${r.courts.name} unavailable`,
        event_type: 'maintenance_scheduled',
        location: r.courts.name,
        starts_at: `${day}T${start}:00`,
        hoa_id: r.courts.hoa_id,
        community_name: hoaNames.get(r.courts.hoa_id) ?? '',
        description: [r.description, `Closed ${start}–${end}`].filter(Boolean).join(' · '),
      });
    }
  }
  return out;
}
