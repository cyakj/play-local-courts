// Pure scheduling helpers for the admin amenity schedule. No React Native imports, so they run
// in plain Node tests. All times are community wall-clock values ('HH:MM[:SS]') — never convert
// them through a device timezone (see communityTime.ts).

export type SlotState = 'available' | 'reserved' | 'pending' | 'blocked' | 'past';

export interface ScheduleBooking {
  id: string;
  userId: string;
  residentName: string;
  startTime: string;
  endTime: string;
  status: string; // 'confirmed' | 'pending'
  playType?: string | null;
}

export interface ScheduleBlockout {
  id: string;
  startTime: string;
  endTime: string;
  description: string | null;
  blockoutType: string | null;
}

export interface Slot {
  startMin: number;
  endMin: number;
  state: SlotState;
  bookings: ScheduleBooking[];
  blockouts: ScheduleBlockout[];
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

export function formatMinutes(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Half-open interval overlap: [aStart, aEnd) with [bStart, bEnd). */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface BuildSlotsInput {
  /** The date being displayed, 'YYYY-MM-DD'. */
  date: string;
  /** Community "today", 'YYYY-MM-DD'. */
  today: string;
  /** Community wall-clock minutes since midnight right now (only used when date === today). */
  nowMinutes: number;
  openMin: number;
  closeMin: number;
  stepMin?: number;
  bookings: ScheduleBooking[];
  blockouts: ScheduleBlockout[];
}

/**
 * Builds the slot grid. Precedence: blocked > past > reserved > pending > available.
 * A blockout always wins, even over a (past) reservation, so the admin sees why the time is closed.
 */
export function buildSlots(input: BuildSlotsInput): Slot[] {
  const { date, today, nowMinutes, openMin, closeMin, bookings, blockouts } = input;
  const step = input.stepMin ?? 60;
  const slots: Slot[] = [];
  for (let start = openMin; start < closeMin; start += step) {
    const end = Math.min(start + step, closeMin);
    const slotBookings = bookings.filter((b) => overlaps(start, end, toMinutes(b.startTime), toMinutes(b.endTime)));
    const slotBlockouts = blockouts.filter((b) => overlaps(start, end, toMinutes(b.startTime), toMinutes(b.endTime)));
    const isPast = date < today || (date === today && end <= nowMinutes);

    let state: SlotState = 'available';
    if (slotBlockouts.length > 0) state = 'blocked';
    else if (isPast) state = 'past';
    else if (slotBookings.some((b) => b.status === 'confirmed')) state = 'reserved';
    else if (slotBookings.some((b) => b.status === 'pending')) state = 'pending';

    slots.push({ startMin: start, endMin: end, state, bookings: slotBookings, blockouts: slotBlockouts });
  }
  return slots;
}

/** Contiguous range covered by the selected slot start-minutes, or null if nothing is selected. */
export function selectionRange(slots: Slot[], selectedStarts: ReadonlySet<number>): { start: number; end: number } | null {
  const chosen = slots.filter((s) => selectedStarts.has(s.startMin));
  if (chosen.length === 0) return null;
  return { start: Math.min(...chosen.map((s) => s.startMin)), end: Math.max(...chosen.map((s) => s.endMin)) };
}

/** Only an available slot can be added to a selection. */
export function isSelectable(slot: Slot): boolean {
  return slot.state === 'available';
}

/**
 * Validates a blockout request the same way the server does (the server remains authoritative).
 * Returns an error message, or null when valid.
 */
export function validateBlockout(input: {
  date: string;
  endDate: string | null;
  startMin: number;
  endMin: number;
  reason: string;
  today: string;
}): string | null {
  const end = input.endDate ?? input.date;
  if (input.startMin >= input.endMin) return 'Start time must be before end time.';
  if (end < input.date) return 'End date must not be before the start date.';
  if (end < input.today) return 'A blockout cannot be created entirely in the past.';
  if (!input.reason.trim()) return 'Enter a reason for the blockout.';
  return null;
}

export const SLOT_STATE_LABEL: Record<SlotState, string> = {
  available: 'Available',
  reserved: 'Reserved',
  pending: 'Pending approval',
  blocked: 'Blocked out',
  past: 'Past',
};
