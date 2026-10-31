// Pure. Rows for the "View Schedule" sheet. The day is partitioned at the REAL boundaries (opening, closing, every
// reservation and blockout start/end) plus the 30 minute grid for open time, so a reservation is shown for exactly the time it
// covers - 09:15-10:15 reads as 09:15-10:15, a 90 minute booking as 90 minutes - and the resident's own reservation is
// distinguishable from everyone else's.
//
// Precedence when intervals overlap (the database forbids overlapping confirmed bookings, but pending ones can overlap):
// maintenance > the resident's own reservation > someone else's reservation > available.
import { toMins, fmtHHMM } from '@/lib/slotAvailability';

export type ScheduleRowType = 'available' | 'booked' | 'mine' | 'maintenance';

export interface ScheduleRow {
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
  type: ScheduleRowType;
  /** Starts on the booking wheel's grid (opening time + n x 30 min), so the wheel offers it (an off-grid open gap cannot be pre-selected). */
  onGrid: boolean;
}

interface Span { start_time: string; end_time: string }
interface BookingSpan extends Span { user_id?: string | null }

const GRID = 30;

export function buildScheduleRows(input: {
  openMins: number;
  closeMins: number;
  bookings: BookingSpan[];
  maintenance: Span[];
  userId: string | null | undefined;
}): ScheduleRow[] {
  const { openMins, closeMins, bookings, maintenance, userId } = input;
  if (closeMins <= openMins) return [];
  const clamp = (m: number) => Math.min(Math.max(m, openMins), closeMins);

  const points = new Set<number>([openMins, closeMins]);
  // The booking wheel offers starts at opening time and every 30 minutes after it (computeSlots), so the grid is relative to opening.
  for (let m = openMins; m < closeMins; m += GRID) points.add(m);
  for (const r of [...bookings, ...maintenance]) { points.add(clamp(toMins(r.start_time))); points.add(clamp(toMins(r.end_time))); }
  const cuts = [...points].sort((a, b) => a - b);

  type Seg = { a: number; b: number; type: ScheduleRowType; key: string };
  const segs: Seg[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const covers = (r: Span) => toMins(r.start_time) < b && toMins(r.end_time) > a;
    const maint = maintenance.find(covers);
    const mine = !!userId ? bookings.find((x) => covers(x) && x.user_id === userId) : undefined;
    const other = bookings.find(covers);
    let type: ScheduleRowType = 'available';
    let key = `a:${a}`;
    if (maint) { type = 'maintenance'; key = `m:${toMins(maint.start_time)}-${toMins(maint.end_time)}`; }
    else if (mine) { type = 'mine'; key = `i:${toMins(mine.start_time)}-${toMins(mine.end_time)}`; }
    else if (other) { type = 'booked'; key = `b:${toMins(other.start_time)}-${toMins(other.end_time)}`; }
    const last = segs[segs.length - 1];
    if (last && last.key === key && type !== 'available') { last.b = b; continue; } // one row per reservation / blockout
    segs.push({ a, b, type, key });
  }
  return segs.map(({ a, b, type }) => ({ start: fmtHHMM(a), end: fmtHHMM(b), type, onGrid: (a - openMins) % GRID === 0 }));
}
