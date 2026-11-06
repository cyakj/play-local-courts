// Concise copy for the reservation detail screen. Pure (Node-testable). Reuses cancellationState: the business rule is unchanged.
import { localToUtcMs } from '@/lib/communityTime';
import { cancellationState } from '@/lib/reservations';
import type { ReservationKind } from '@/lib/reservationState';

/** One short line under the status pill. Only promises a hold when the server really enforces exclusive pending holds. */
export function detailSummary(kind: ReservationKind, holdsEnforced: boolean, communityName?: string | null): string {
  const hoa = communityName ? `${communityName}'s administrator` : 'your HOA';
  switch (kind) {
    case 'pending':
      return holdsEnforced
        ? 'Awaiting HOA approval. Your time is held until reviewed or the reservation starts.'
        : 'Awaiting HOA approval. Your reservation is not confirmed yet.';
    case 'confirmed': return 'Your reservation is confirmed.';
    case 'in_progress': return 'Happening now.';
    case 'completed': return 'This reservation has ended.';
    case 'request_expired': return 'Not approved before its start time, so it expired and the time was released.';
    case 'rejected': return `Declined by ${hoa}.`;
    case 'cancelled': return 'This reservation was cancelled.';
    default: return '';
  }
}

export type CancellationLine =
  | { kind: 'available'; text: string }
  | { kind: 'closed'; text: string }
  | { kind: 'status'; text: string }
  | { kind: 'none' };

function formatDeadline(ms: number, timeZone: string): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  return `${date} at ${time}`;
}

/**
 * ONE cancellation message for the screen (never a policy line plus a second "unavailable" box).
 * available: "Cancel before Nov 5 at 9:00 AM." closed: "Cancellation closed · Less than 24 hours before start."
 * Reservations that are not pending/confirmed get no cancellation line; an ended/started one says so instead of blaming a deadline.
 */
export function cancellationLine(input: {
  kind: ReservationKind; status: string; date: string; startTime: string; minHours: number | null; now: Date; timeZone: string; zoneUnavailable?: boolean;
}): CancellationLine {
  const { kind, status, date, startTime, minHours, now, timeZone } = input;
  if (kind === 'completed' || kind === 'request_expired' || kind === 'rejected' || kind === 'cancelled') return { kind: 'none' };
  if (status !== 'pending' && status !== 'confirmed') return { kind: 'none' };
  if (kind === 'in_progress') return { kind: 'status', text: 'Already started, so it can no longer be cancelled.' };
  if (input.zoneUnavailable) return { kind: 'status', text: "Cancellation is unavailable until your community's time zone can be loaded." };
  const hours = minHours ?? 0;
  const st = cancellationState({ status, date, startTime, minHours: hours, now, timeZone });
  if (st.canCancel) {
    if (hours <= 0) return { kind: 'available', text: 'Cancel any time before it starts.' };
    return { kind: 'available', text: `Cancel before ${formatDeadline(localToUtcMs(date, startTime, timeZone) - hours * 3600000, timeZone)}.` };
  }
  if (st.short === 'Started') return { kind: 'status', text: 'Already started, so it can no longer be cancelled.' };
  return { kind: 'closed', text: `Cancellation closed · Less than ${hours} hour${hours === 1 ? '' : 's'} before start.` };
}
