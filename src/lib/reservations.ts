// Reservation presentation + cancellation rules shared by My Reservations, the
// reservation detail screen and the admin approval list. Pure (Node-testable).
import { COMMUNITY_TIME_ZONE, communityToday, formatDuration, hoursUntilStart } from '@/lib/communityTime';
import type { ReservationKind } from '@/lib/reservationState';

export type ReservationStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface StatusDisplay {
  label: string;
  /** Plain-language explanation shown on the detail screen. */
  description: string;
  tone: 'warning' | 'positive' | 'negative' | 'muted';
}

export function statusDisplay(status: string, communityName?: string): StatusDisplay {
  const by = communityName ? `${communityName}'s administrator` : 'your community administrator';
  switch (status) {
    case 'pending':
      return {
        label: 'Pending approval',
        description: `This amenity requires approval. Your request is waiting for ${by}. It is not confirmed yet, but the time is held for you while it waits. It is released if the request is declined or cancelled, or if it is not approved before the start time.`,
        tone: 'warning',
      };
    case 'confirmed':
      return { label: 'Confirmed', description: 'Your reservation is confirmed.', tone: 'positive' };
    case 'rejected':
      return { label: 'Declined', description: `${by.charAt(0).toUpperCase()}${by.slice(1)} declined this request.`, tone: 'negative' };
    case 'cancelled':
      return { label: 'Cancelled', description: 'This reservation was cancelled.', tone: 'muted' };
    case 'expired':
      return { label: 'Request expired', description: 'This request was not approved before its start time, so it expired and the time was released.', tone: 'muted' };
    default:
      return { label: status, description: '', tone: 'muted' };
  }
}

export interface CancellationState {
  canCancel: boolean;
  /** Why cancelling is unavailable (undefined when it is available or irrelevant). */
  reason?: string;
  /** Short chip text for list cards. */
  short?: string;
}

/**
 * Mirrors the server rule (enforce_booking_cancellation_window): a resident may cancel a
 * pending/confirmed booking only while it starts at least `minHours` from now, measured in
 * community time. The server remains the authority; this explains it up front.
 */
export function cancellationState(input: {
  status: string;
  date: string;
  startTime: string;
  minHours: number;
  now?: Date;
  timeZone?: string;
}): CancellationState {
  const { status, date, startTime, minHours, now, timeZone } = input;
  if (status !== 'pending' && status !== 'confirmed') return { canCancel: false };

  const hours = hoursUntilStart(date, startTime, now, timeZone);
  if (hours <= 0) {
    return { canCancel: false, reason: 'This reservation has already started, so it can no longer be cancelled.', short: 'Started' };
  }
  if (hours < minHours) {
    return {
      canCancel: false,
      reason: `Cancellations close ${minHours} hour${minHours === 1 ? '' : 's'} before the start time. This reservation starts in ${formatDuration(hours)}.`,
      short: `Closed ${minHours}h before start`,
    };
  }
  return { canCancel: true };
}

/** Pending/confirmed and not yet over, by END time at the community. Prefer reservationState.isCurrentReservation. */
export function isUpcoming(status: string, date: string, endTime: string, now?: Date): boolean {
  if (status !== 'pending' && status !== 'confirmed') return false;
  return hoursUntilStart(date, endTime, now) > 0;
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mins = m && m !== '00' ? `:${m}` : '';
  return `${display}${mins} ${suffix}`;
}

export function formatLongDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "Today" / "Tomorrow" / "In 3 days" by COMMUNITY calendar day (not the phone's); null when further away or past. */
export function relativeDay(isoDate: string, now: Date = new Date(), timeZone = COMMUNITY_TIME_ZONE): string | null {
  const day = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const days = Math.round((day(isoDate) - day(communityToday(now, timeZone))) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days <= 6) return `In ${days} days`;
  return null;
}

/** "1 h 30 min" style length of a reservation from its start and end times (HH:MM or HH:MM:SS). */
export function durationLabel(start: string, end: string): string {
  const mins = (t: string) => { const [h, mm] = t.split(':').map(Number); return h * 60 + (mm || 0); };
  const total = Math.max(0, mins(end) - mins(start));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Plain-language explanation for a derived kind (pending vs confirmed vs over). Never says "confirmed" for a request. */
export function kindDescription(kind: ReservationKind, communityName?: string): string {
  const by = communityName ? `${communityName}'s administrator` : 'your community administrator';
  switch (kind) {
    case 'pending': return `This amenity requires approval. Your request is waiting for ${by}. It is NOT confirmed yet, but the time is held for you while it waits. It is released if the request is declined or cancelled, or if it is not approved before the start time.`;
    case 'confirmed': return 'Your reservation is confirmed.';
    case 'in_progress': return 'Your reservation is happening now.';
    case 'completed': return 'This reservation has ended.';
    case 'request_expired': return 'This request was not approved before its start time, so it expired and the time was released.';
    case 'rejected': return `${by.charAt(0).toUpperCase()}${by.slice(1)} declined this request.`;
    case 'cancelled': return 'This reservation was cancelled.';
    default: return '';
  }
}
