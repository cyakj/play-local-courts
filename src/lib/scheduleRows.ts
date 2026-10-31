// Pure. Rows for the "View Schedule" sheet. Cells are 30 minutes (the same grain as the reservation wheel) and each
// reservation / blockout becomes ONE row of its true length, so a 90 minute booking reads as 90 minutes - never two full
// hour rows - and the resident's own reservation is distinguishable from everyone else's.
import { toMins, fmtHHMM } from '@/lib/slotAvailability';

export type ScheduleRowType = 'available' | 'booked' | 'mine' | 'maintenance';

export interface ScheduleRow {
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
  type: ScheduleRowType;
}

interface Span { start_time: string; end_time: string }
interface BookingSpan extends Span { user_id?: string | null }

const CELL = 30;

export function buildScheduleRows(input: {
  openMins: number;
  closeMins: number;
  bookings: BookingSpan[];
  maintenance: Span[];
  userId: string | null | undefined;
}): ScheduleRow[] {
  const { openMins, closeMins, bookings, maintenance, userId } = input;
  const hit = (c: number, r: Span) => c < toMins(r.end_time) && c + CELL > toMins(r.start_time);
  const rows: Array<ScheduleRow & { key: string }> = [];
  for (let c = openMins; c + CELL <= closeMins; c += CELL) {
    const maint = maintenance.find((m) => hit(c, m));
    const booking = bookings.find((b) => hit(c, b));
    let type: ScheduleRowType = 'available';
    let key = `a:${c}`; // available cells never merge
    if (maint) { type = 'maintenance'; key = `m:${toMins(maint.start_time)}-${toMins(maint.end_time)}`; }
    else if (booking) {
      type = !!userId && booking.user_id === userId ? 'mine' : 'booked';
      key = `${type[0]}:${toMins(booking.start_time)}-${toMins(booking.end_time)}`;
    }
    const last = rows[rows.length - 1];
    if (last && last.key === key && type !== 'available') { last.end = fmtHHMM(c + CELL); continue; }
    rows.push({ start: fmtHHMM(c), end: fmtHHMM(c + CELL), type, key });
  }
  return rows.map(({ start, end, type }) => ({ start, end, type }));
}
