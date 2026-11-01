// ONE place that decides what a reservation IS right now. Pure (Node-testable, no React / Supabase).
//
// Three independent dimensions are kept apart so no screen has to re-derive them:
//   * ownership   - whose it is (callers know this; a reservation can be yours and still be over)
//   * approval    - the stored `bookings.status`: pending | confirmed | rejected | cancelled | expired (after migration 20261031110000)
//   * time phase  - DERIVED from the community clock: upcoming | in_progress | ended
// "In progress" and "completed" are never stored; they come from the end timestamp.
//
// `bookings.date/start_time/end_time` are zone-less community wall-clock values (see communityTime.ts), so every
// comparison is made against "now at the community", never against UTC or the phone's own clock.
import type { TimeRange } from '@/lib/slotAvailability';
import { COMMUNITY_TIME_ZONE, communityMinutesNow, communityNowMs, communityToday, wallClockMs } from '@/lib/communityTime';

export type ApprovalStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
export type TimePhase = 'upcoming' | 'in_progress' | 'ended';

export type ReservationKind =
  | 'confirmed'        // approved, not started
  | 'in_progress'      // approved, started, not ended
  | 'completed'        // approved, ended
  | 'pending'          // waiting for an administrator, not ended
  | 'request_expired'  // never approved and the time has passed
  | 'rejected'
  | 'cancelled'
  | 'unknown';

export interface ReservationLike {
  status: string;
  date: string;
  start_time: string;
  end_time: string;
}

/** Wall-clock end as epoch-ms-in-UTC. A row with end <= start (not producible by the schema) ends the NEXT day. */
export function endMs(date: string, start: string, end: string): number {
  const s = wallClockMs(date, start);
  const e = wallClockMs(date, end);
  return e > s ? e : e + 86_400_000;
}

export function timePhase(r: Pick<ReservationLike, 'date' | 'start_time' | 'end_time'>, now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): TimePhase {
  const n = communityNowMs(now, timeZone);
  if (n >= endMs(r.date, r.start_time, r.end_time)) return 'ended';
  if (n >= wallClockMs(r.date, r.start_time)) return 'in_progress';
  return 'upcoming';
}

export function reservationKind(r: ReservationLike, now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): ReservationKind {
  const phase = timePhase(r, now, timeZone);
  switch (r.status) {
    case 'confirmed': return phase === 'ended' ? 'completed' : phase === 'in_progress' ? 'in_progress' : 'confirmed';
    // A pending request expires at its START (V1 rule, enforced by the database): once the start has passed it is expired,
    // never "pending" and never "in progress".
    case 'pending': return phase === 'upcoming' ? 'pending' : 'request_expired';
    case 'expired': return 'request_expired';
    case 'rejected': return 'rejected';
    case 'cancelled': return 'cancelled';
    default: return 'unknown';
  }
}

/** Pending or confirmed AND not yet over. The only reservations that are "upcoming", "mine" in a picker, or counted. */
export function isCurrentReservation(r: ReservationLike, now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): boolean {
  const k = reservationKind(r, now, timeZone);
  return k === 'confirmed' || k === 'in_progress' || k === 'pending';
}

/** Current reservations, soonest first (ties: earlier end). */
export function selectCurrentReservations<T extends ReservationLike>(list: T[], now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): T[] {
  return list
    .filter((r) => isCurrentReservation(r, now, timeZone))
    .sort((a, b) => wallClockMs(a.date, a.start_time) - wallClockMs(b.date, b.start_time) || endMs(a.date, a.start_time, a.end_time) - endMs(b.date, b.start_time, b.end_time));
}

/**
 * Earliest date worth fetching for "current" reservations: yesterday's community date, so an evening booking that
 * runs past midnight is still loaded. Callers must still filter with isCurrentReservation.
 */
export function currentWindowStartDate(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): string {
  const t = communityToday(now, timeZone);
  const [y, m, d] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * PostgREST `or=` filter for HISTORY: the exact complement of currentBookingsFilter over the resident's own rows - every row that
 * is not a current reservation (cancelled/rejected/expired of any date, anything before today, and today's confirmed rows that have
 * ended / pending rows that have started). Never includes a current reservation, so a page of history cannot be filled with
 * upcoming rows.
 */
export function historyBookingsFilter(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): { today: string; or: string } {
  const f = currentBookingsFilter(now, timeZone);
  const mins = communityMinutesNow(now, timeZone);
  const t = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;
  return {
    today: f.today,
    or: [
      'status.in.(cancelled,rejected,expired)',
      `date.lt.${f.today}`,
      `and(status.eq.confirmed,date.eq.${f.today},end_time.lte.${t})`,
      `and(status.eq.pending,date.eq.${f.today},start_time.lte.${t})`,
    ].join(','),
  };
}

export type BadgeTone = 'positive' | 'info' | 'warning' | 'negative' | 'muted';
export type BadgeIcon = 'check' | 'clock' | 'play' | 'x' | 'history';

export interface ReservationBadge {
  label: string;
  /** Short upper-case label for compact chips on court cards. */
  chip: string;
  tone: BadgeTone;
  icon: BadgeIcon;
}

/** The one label / tone / icon table every reservation surface renders from. Text + icon, never colour alone. */
export function reservationBadge(kind: ReservationKind): ReservationBadge {
  switch (kind) {
    case 'confirmed': return { label: 'Confirmed', chip: 'CONFIRMED', tone: 'info', icon: 'check' };
    case 'in_progress': return { label: 'In progress', chip: 'IN PROGRESS', tone: 'info', icon: 'play' };
    case 'completed': return { label: 'Completed', chip: 'COMPLETED', tone: 'muted', icon: 'history' };
    case 'pending': return { label: 'Pending approval', chip: 'PENDING APPROVAL', tone: 'warning', icon: 'clock' };
    case 'request_expired': return { label: 'Request expired', chip: 'EXPIRED', tone: 'muted', icon: 'history' };
    case 'rejected': return { label: 'Declined', chip: 'DECLINED', tone: 'negative', icon: 'x' };
    case 'cancelled': return { label: 'Cancelled', chip: 'CANCELLED', tone: 'muted', icon: 'x' };
    default: return { label: 'Unknown', chip: 'UNKNOWN', tone: 'muted', icon: 'history' };
  }
}

/**
 * A stored booking row as the slot picker needs it. Ownership, approval and time are kept apart:
 * `isMine` = yours AND still current (an ended booking is history, not "yours" in the picker); `pending` = awaiting
 * approval; `ended` = over (occupies nothing); `ownForCap` = yours at all (the database daily cap counts it regardless).
 */
export function toSlotReservation(
  b: { start_time: string; end_time: string; user_id?: string | null; status?: string | null },
  date: string,
  userId: string | null | undefined,
  now: Date = new Date(),
  timeZone = COMMUNITY_TIME_ZONE,
): TimeRange {
  const own = !!userId && b.user_id === userId;
  const phase = timePhase({ date, start_time: b.start_time, end_time: b.end_time }, now, timeZone);
  // A pending request holds its time only until its start (then it expires); a confirmed one until its end.
  const ended = b.status === 'expired' || (b.status === 'pending' ? phase !== 'upcoming' : phase === 'ended');
  return { start_time: b.start_time, end_time: b.end_time, isMine: own && !ended, pending: b.status === 'pending', ended, ownForCap: own && b.status !== 'expired' && !(b.status === 'pending' && phase !== 'upcoming') };
}

/** Community date key (YYYY-MM-DD) as a local Date at midnight, so device-local date arithmetic lands on the community's day. */
export function communityDate(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): Date {
  const [y, m, d] = communityToday(now, timeZone).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Wording where ownership matters (court cards, pickers): "My pending request" is never "My confirmed reservation". */
export function ownLabel(kind: ReservationKind): string {
  switch (kind) {
    case 'pending': return 'My pending request';
    case 'confirmed': return 'My confirmed reservation';
    case 'in_progress': return 'My reservation - in progress';
    default: return reservationBadge(kind).label;
  }
}

/**
 * PostgREST `or=` filter that keeps only CURRENT reservations on the server, so a resident's next booking can never be pushed
 * out of the first page by old rows: confirmed rows whose END is still ahead, pending rows whose START is still ahead
 * (a pending request expires at its start). Use together with `.gte('date', today)`; the client re-checks with
 * isCurrentReservation. Community date and time come from the HOA's zone.
 */
export function currentBookingsFilter(now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): { today: string; or: string } {
  const today = communityToday(now, timeZone);
  const mins = communityMinutesNow(now, timeZone);
  const t = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;
  return {
    today,
    or: [
      `and(status.eq.confirmed,date.gt.${today})`,
      `and(status.eq.confirmed,date.eq.${today},end_time.gt.${t})`,
      `and(status.eq.pending,date.gt.${today})`,
      `and(status.eq.pending,date.eq.${today},start_time.gt.${t})`,
    ].join(','),
  };
}
