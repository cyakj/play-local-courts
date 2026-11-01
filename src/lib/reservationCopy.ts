// Short customer-facing copy for the reservation sheet. Pure (no React Native) so Node tests can pin the wording and the rules for
// when a promise may be made.

function clock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Available to book: 7 AM–7 PM" from the amenity's own hours; null when the amenity has no hours configured. */
export function availableToBookLine(rules: { booking_start_time?: string | null; booking_end_time?: string | null } | null | undefined): string | null {
  if (!rules?.booking_start_time || !rules?.booking_end_time) return null;
  return `Available to book: ${clock(rules.booking_start_time)}–${clock(rules.booking_end_time)}`;
}

/**
 * The approval notice. A pending request only HOLDS its time when the server enforces exclusive pending holds (migration
 * 20261031110000, detected by the presence of get_amenity_busy_times). Without it we must not promise a hold.
 */
export function approvalNotice(requiresApproval: boolean, holdsEnforced: boolean): string | null {
  if (!requiresApproval) return null;
  return holdsEnforced
    ? 'Approval required · Your time is held until reviewed or it starts.'
    : 'Approval required · An administrator will review your request.';
}

/** Temporary, accurate state while the server cannot show other residents' reservations. Never implies availability is known. */
export const OTHERS_NOT_SHOWN_NOTE = "Other residents' bookings aren't shown yet, so a time may be taken.";

export interface LegendItemDef { key: string; short: string; full: string }
/** Short visible label + the full description used for accessibility. */
export const LEGEND_LABELS: Record<string, LegendItemDef> = {
  available: { key: 'available', short: 'Available', full: 'Available' },
  selected: { key: 'selected', short: 'Selected', full: 'Selected' },
  reserved: { key: 'reserved', short: 'Reserved', full: 'Reserved by someone else' },
  blocked: { key: 'blocked', short: 'Blocked', full: 'Blocked by management' },
  mine: { key: 'mine', short: 'Mine', full: 'My reservation' },
  pending: { key: 'pending', short: 'Pending', full: 'My request, pending approval' },
  past: { key: 'past', short: 'Past', full: 'Completed or passed' },
};
