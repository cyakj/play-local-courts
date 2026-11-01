/**
 * Reservation status / time / ownership rules (resident acceptance round 2). Node only:
 *   npx playwright test -c playwright.logic.config.ts reservation-state
 * Puerto Rico is UTC-4 all year (no DST). 2026-10-31 19:00 PR == 2026-10-31T23:00:00Z.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  communityDate, currentWindowStartDate, isCurrentReservation, ownLabel, reservationBadge, reservationKind,
  selectCurrentReservations, toSlotReservation,
} from '../src/lib/reservationState';
import { kindDescription, relativeDay } from '../src/lib/reservations';
import { computeSlots } from '../src/lib/slotAvailability';
import { buildScheduleRows } from '../src/lib/scheduleRows';
import { friendlyStorageError } from '../src/lib/profilePhoto';

const z = (iso: string) => new Date(iso);
const morning = { status: 'confirmed', date: '2026-10-31', start_time: '11:00:00', end_time: '12:00:00' };
const src = (p: string) => fs.readFileSync(path.join(__dirname, '..', 'src', p), 'utf8');

test.describe('the Oct 31 11:00-12:00 booking at 7 PM', () => {
  test('REGRESSION: it is over - completed, not current, not upcoming', () => {
    const now = z('2026-10-31T23:00:00Z'); // 19:00 PR
    expect(reservationKind(morning, now)).toBe('completed');
    expect(isCurrentReservation(morning, now)).toBe(false);
    expect(selectCurrentReservations([morning], now)).toEqual([]);
  });
  test('before / during / after the same-day booking', () => {
    expect(reservationKind(morning, z('2026-10-31T14:00:00Z'))).toBe('confirmed'); // 10:00
    expect(reservationKind(morning, z('2026-10-31T15:00:00Z'))).toBe('in_progress'); // 11:00 exactly
    expect(reservationKind(morning, z('2026-10-31T15:59:59Z'))).toBe('in_progress');
    expect(reservationKind(morning, z('2026-10-31T16:00:00Z'))).toBe('completed'); // 12:00 exactly
    expect(isCurrentReservation(morning, z('2026-10-31T15:30:00Z'))).toBe(true);
  });
  test('a UTC-date compare would be wrong after 8 PM PR; the community clock is not', () => {
    const evening = { status: 'confirmed', date: '2026-10-31', start_time: '21:00:00', end_time: '22:00:00' };
    const now = z('2026-11-01T00:30:00Z'); // 20:30 PR on Oct 31, already Nov 1 in UTC
    expect(reservationKind(evening, now)).toBe('confirmed');
    expect(currentWindowStartDate(now)).toBe('2026-10-30');
    expect(relativeDay('2026-11-01', now)).toBe('Tomorrow'); // community Nov 1 is tomorrow, not today
    expect(relativeDay('2026-10-31', now)).toBe('Today');
  });
});

test.describe('approval status', () => {
  const now = z('2026-10-31T14:00:00Z');
  const base = { date: '2026-10-31', start_time: '16:00:00', end_time: '17:00:00' };
  test('pending is Pending approval and never Confirmed', () => {
    const k = reservationKind({ ...base, status: 'pending' }, now);
    expect(k).toBe('pending');
    expect(reservationBadge(k).label).toBe('Pending approval');
    expect(reservationBadge(k).label).not.toMatch(/confirm/i);
    expect(ownLabel(k)).toBe('My pending request');
    expect(kindDescription(k)).toMatch(/NOT confirmed/);
    expect(isCurrentReservation({ ...base, status: 'pending' }, now)).toBe(true);
  });
  test('a pending request that was never approved and has passed is expired history, not upcoming', () => {
    const late = z('2026-10-31T23:00:00Z');
    expect(reservationKind({ ...base, status: 'pending' }, late)).toBe('request_expired');
    expect(isCurrentReservation({ ...base, status: 'pending' }, late)).toBe(false);
  });
  test('rejected and cancelled are never current or confirmed, even in the future', () => {
    for (const status of ['rejected', 'cancelled']) {
      const r = { ...base, status };
      expect(isCurrentReservation(r, now)).toBe(false);
      expect(reservationBadge(reservationKind(r, now)).label).not.toMatch(/confirmed/i);
    }
    expect(reservationBadge('rejected').label).toBe('Declined');
  });
  test('lifecycle: pending -> confirmed -> in progress -> completed, and pending -> rejected / cancelled', () => {
    const row = (status: string) => ({ ...base, status });
    expect(reservationKind(row('pending'), now)).toBe('pending');
    expect(reservationKind(row('confirmed'), now)).toBe('confirmed'); // approved
    expect(reservationKind(row('confirmed'), z('2026-10-31T20:30:00Z'))).toBe('in_progress'); // 16:30
    expect(reservationKind(row('confirmed'), z('2026-10-31T21:00:00Z'))).toBe('completed'); // 17:00
    expect(isCurrentReservation(row('rejected'), now)).toBe(false);
    expect(isCurrentReservation(row('cancelled'), now)).toBe(false); // confirmed -> cancelled too
    expect(ownLabel('confirmed')).toBe('My confirmed reservation');
  });
  test('an unknown status is never treated as current', () => {
    expect(isCurrentReservation({ ...base, status: 'weird' }, now)).toBe(false);
  });
});

test.describe('midnight and time zones', () => {
  test('midnight crossing (end <= start ends the next day; 24:00 also works)', () => {
    const night = { status: 'confirmed', date: '2026-10-31', start_time: '23:30:00', end_time: '00:30:00' };
    expect(reservationKind(night, z('2026-11-01T03:15:00Z'))).toBe('confirmed'); // 23:15 PR - not started
    expect(reservationKind(night, z('2026-11-01T04:15:00Z'))).toBe('in_progress'); // 00:15 PR Nov 1
    expect(reservationKind(night, z('2026-11-01T04:30:00Z'))).toBe('completed'); // 00:30 PR
    const t24 = { status: 'confirmed', date: '2026-10-31', start_time: '23:00:00', end_time: '24:00:00' };
    expect(reservationKind(t24, z('2026-11-01T03:59:00Z'))).toBe('in_progress');
    expect(reservationKind(t24, z('2026-11-01T04:00:00Z'))).toBe('completed');
  });
  test('another community time zone (explicit timeZone argument)', () => {
    const r = { status: 'confirmed', date: '2026-11-01', start_time: '09:00:00', end_time: '10:00:00' };
    const now = z('2026-11-01T00:30:00Z');
    expect(reservationKind(r, now, 'Asia/Tokyo')).toBe('in_progress'); // 09:30 in Tokyo
    expect(reservationKind(r, now)).toBe('confirmed'); // 20:30 the day before in Puerto Rico
    const ny = { status: 'confirmed', date: '2026-11-01', start_time: '12:00:00', end_time: '13:00:00' };
    expect(reservationKind(ny, z('2026-11-01T17:30:00Z'), 'America/New_York')).toBe('in_progress'); // after DST ended: EST
  });
  test('independent of the phone time zone', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(reservationKind(morning, z('2026-10-31T23:00:00Z'))).toBe('completed');
      expect(communityDate(z('2026-11-01T00:30:00Z')).getDate()).toBe(31);
    } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
  });
  test('selectCurrentReservations drops ended rows and sorts by start', () => {
    const now = z('2026-10-31T23:00:00Z');
    const list = [
      { id: 'late', status: 'confirmed', date: '2026-11-02', start_time: '09:00', end_time: '10:00' },
      { id: 'old', ...morning },
      { id: 'soon', status: 'pending', date: '2026-10-31', start_time: '20:00', end_time: '21:00' },
    ];
    expect(selectCurrentReservations(list, now).map((r) => r.id)).toEqual(['soon', 'late']);
  });
});

test.describe('ownership vs time vs approval in the picker', () => {
  const day = '2026-10-31';
  test('an ended booking of mine is not "mine" in the picker but still counts toward the daily cap', () => {
    const now = z('2026-10-31T23:00:00Z');
    const mineEnded = toSlotReservation({ ...morning, user_id: 'me' }, day, 'me', now);
    expect(mineEnded).toMatchObject({ isMine: false, ended: true, ownForCap: true });
    const slots = computeSlots({ openMins: 7 * 60, closeMins: 22 * 60, durationMins: 60, isToday: true, nowMins: 19 * 60, reservations: [mineEnded], blocks: [], limits: { maxPerDay: 1 } });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.state === 'limit')).toBe(true); // the server would reject a second booking today
    const noCap = computeSlots({ openMins: 7 * 60, closeMins: 22 * 60, durationMins: 60, isToday: true, nowMins: 19 * 60, reservations: [mineEnded], blocks: [] });
    expect(noCap.some((s) => s.state === 'reserved')).toBe(false); // ended rows occupy nothing
  });
  test('a 90 minute pending booking of mine marks exactly three half-hour starts as pending, not confirmed', () => {
    const now = z('2026-10-31T12:00:00Z');
    const pending = toSlotReservation({ start_time: '16:00', end_time: '17:30', user_id: 'me', status: 'pending' }, day, 'me', now);
    const slots = computeSlots({ openMins: 8 * 60, closeMins: 20 * 60, durationMins: 30, isToday: false, nowMins: 0, reservations: [pending], blocks: [] });
    const mine = slots.filter((s) => s.mine);
    expect(mine.map((s) => s.start)).toEqual(['16:00', '16:30', '17:00']);
    expect(mine.every((s) => s.pending === true)).toBe(true);
    const confirmed = toSlotReservation({ start_time: '16:00', end_time: '17:30', user_id: 'me', status: 'confirmed' }, day, 'me', now);
    const cs = computeSlots({ openMins: 8 * 60, closeMins: 20 * 60, durationMins: 30, isToday: false, nowMins: 0, reservations: [confirmed], blocks: [] });
    expect(cs.filter((s) => s.mine).map((s) => s.start)).toEqual(['16:00', '16:30', '17:00']);
    expect(cs.filter((s) => s.mine).every((s) => !s.pending)).toBe(true);
  });
  test("someone else's reservation is never mine", () => {
    const r = toSlotReservation({ start_time: '10:00', end_time: '11:00', user_id: 'other', status: 'confirmed' }, '2026-11-02', 'me', z('2026-10-31T12:00:00Z'));
    expect(r.isMine).toBe(false);
    expect(r.ownForCap).toBe(false);
  });
});

test.describe('View Schedule rows', () => {
  const open = 8 * 60, close = 20 * 60;
  test('REGRESSION: an ended booking is a muted "past" row, kept (not deleted), with its true 60 minute length', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: 'me', maintenance: [],
      bookings: [{ start_time: '11:00', end_time: '12:00', user_id: 'me', status: 'confirmed' }],
      phase: { isPast: false, isToday: true, nowMins: 19 * 60 } });
    expect(rows.find((r) => r.type === 'mine')).toEqual({ start: '11:00', end: '12:00', type: 'mine', onGrid: true, past: true });
    expect(rows.find((r) => r.start === '19:00')?.past).toBe(false);
    expect(rows.find((r) => r.start === '09:00')?.past).toBe(true); // an unused hour that already passed
  });
  test('pending booking of mine is its own row type; an in-progress booking stays ONE row and is not expired early', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: 'me', maintenance: [],
      bookings: [{ start_time: '16:00', end_time: '17:30', user_id: 'me', status: 'pending' }],
      phase: { isPast: false, isToday: true, nowMins: 16 * 60 + 45 } });
    const mine = rows.filter((r) => r.type === 'mine_pending');
    expect(mine.map((r) => [r.start, r.end, r.past])).toEqual([['16:00', '17:30', false]]);
  });
  test('a 90 minute future booking is one row; a past date is entirely past; maintenance is never "past"', () => {
    const future = buildScheduleRows({ openMins: open, closeMins: close, userId: 'me', maintenance: [], bookings: [{ start_time: '10:00', end_time: '11:30', user_id: 'me', status: 'confirmed' }] });
    expect(future.filter((r) => r.type === 'mine')).toHaveLength(1);
    const past = buildScheduleRows({ openMins: open, closeMins: close, userId: 'me', maintenance: [{ start_time: '12:00', end_time: '13:00' }], bookings: [], phase: { isPast: true, isToday: false, nowMins: 0 } });
    expect(past.filter((r) => r.type === 'available').every((r) => r.past)).toBe(true);
    expect(past.find((r) => r.type === 'maintenance')?.past).toBe(false);
  });
});

test.describe('profile photo error mapping', () => {
  test('only a missing bucket is reported as "not enabled on this server"', () => {
    expect(friendlyStorageError('Bucket not found')).toMatch(/not enabled on this server/);
    expect(friendlyStorageError('Object not found')).not.toMatch(/not enabled on this server/);
    expect(friendlyStorageError('new row violates row-level security policy')).toMatch(/not allowed/);
    expect(friendlyStorageError('The object exceeded the maximum allowed size')).toMatch(/5 MB/);
  });
});

test.describe('wiring (source patterns that fail on the previous implementation)', () => {
  test('Home selects the next reservation with the community clock, not a UTC date and limit(1)', () => {
    const h = src('app/(resident)/index.tsx');
    expect(h).toMatch(/selectCurrentReservations\(bookingRows, now\)/);
    expect(h).toMatch(/currentWindowStartDate\(\)/);
    expect(h).not.toMatch(/\.gte\('date', today\)\s*\n\s*\.in\('status', \['confirmed', 'pending'\]\)/);
    expect(h).toMatch(/useNow\(/);
    expect(h).toMatch(/<ReservationBadge kind=\{nextBookingKind\}/);
  });
  test('Court list: no date-only "my booking", community clock, pending/ended derived', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).not.toMatch(/userBookings\.find\(b => b\.date === toDateKey\(now\)\)/);
    expect(c).not.toMatch(/const now = useMemo\(\(\) => new Date\(\), \[\]\)/);
    expect(c).toMatch(/toSlotReservation\(/);
    expect(c).toMatch(/ownLabel\(myKind!\)/);
    expect(c).toMatch(/Request Reservation/);
    expect(c).toMatch(/<ReservationLegend theme=\{theme\} variant="schedule"/);
    expect(c).toMatch(/<ReservationLegend theme=\{theme\} variant="picker"/);
  });
  test('Account menu has no redundant Account Settings row; keeps Sign Out and conditional switching', () => {
    const m = src('components/ui/AccountMenu.tsx');
    expect(m).not.toMatch(/menu-account-settings/);
    expect(m).not.toMatch(/settings-account/);
    expect(m).toMatch(/menu-sign-out/);
    expect(m).toMatch(/canSwitchCommunity/);
    expect(m).toMatch(/canSwitchRole/);
  });
  test('Back button shows a label on wide screens and stays a >= 44pt target', () => {
    const b = src('components/ui/BackButton.tsx');
    expect(b).toMatch(/\{label\}<\/Text>/);
    expect(src('constants/headerBrand.ts')).toMatch(/size: 48/);
  });
});

test.describe('inspection round 1 follow-ups', () => {
  test('R2-F01: the wheel renders pending slots amber with explicit wording', () => {
    const w = src('components/ui/TimeSlotWheel.tsx');
    expect(w).toMatch(/slot\.mine && slot\.pending \? 'your request, pending approval'/);
    expect(w).toMatch(/'Pending'/);
    expect(w).toMatch(/statePillPending/);
  });
  test('R2-F03/F04/F05: latest loader on focus, load generations, clock in slot derivation, refetch on focus', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).toMatch(/loadGenRef\.current === myGen/);
    expect(c).toMatch(/loadCoursRefLatest\.current/);
    expect(c).toMatch(/sheetMaintenanceAll, now\]\)/);
    expect(c).toMatch(/dateStr < communityToday\(freshNow\)\) return \[\]/);
    expect(c).toMatch(/dateStr < communityToday\(nowD\) \? 'gone'/);
    expect(src('hooks/useNow.ts')).toMatch(/if \(firstFocus\.current\)[^\n]*\s+refreshRef\.current\?\.\(\)/);
  });
});

test.describe('inspection round 2 follow-ups', () => {
  test('R2-101/102: open sheets are re-fetched on refresh; own bookings are paged to completion', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).toMatch(/fetchBookingsForDate\(toDateKey\(sheetDate\), \[bookingSheet\.courtId\]\);\s*\n\s*if \(scheduleSheet\)/);
    expect(c).toMatch(/\.range\(from, from \+ 99\)/);
    expect(c).not.toMatch(/ACTIVE_BOOKING_STATUSES\)\.order\('date'\)\.order\('start_time'\)\.limit\(50\)/);
  });
});
