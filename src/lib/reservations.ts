// Reservation presentation + cancellation rules shared by My Reservations, the
// reservation detail screen and the admin approval list. Pure (Node-testable).
import { formatDuration, hoursUntilStart } from '@/lib/communityTime';

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
        description: `This amenity requires approval. Your request is waiting for ${by}. The time is not held for you until it is approved.`,
        tone: 'warning',
      };
    case 'confirmed':
      return { label: 'Confirmed', description: 'Your reservation is confirmed.', tone: 'positive' };
    case 'rejected':
      return { label: 'Declined', description: `${by.charAt(0).toUpperCase()}${by.slice(1)} declined this request.`, tone: 'negative' };
    case 'cancelled':
      return { label: 'Cancelled', description: 'This reservation was cancelled.', tone: 'muted' };
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
}): CancellationState {
  const { status, date, startTime, minHours, now } = input;
  if (status !== 'pending' && status !== 'confirmed') return { canCancel: false };

  const hours = hoursUntilStart(date, startTime, now);
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

export function isUpcoming(status: string, date: string, endTime: string, now?: Date): boolean {
  if (status === 'cancelled' || status === 'rejected') return false;
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
