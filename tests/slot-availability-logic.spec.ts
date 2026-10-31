/**
 * V1-012: slot availability rules. Node only:  npx playwright test -c playwright.logic.config.ts slot-availability
 */
import { test, expect } from '@playwright/test';
import { computeSlots, revalidateSelection, toDateKey, isSelectable, limitReason, type ComputeSlotsInput } from '../src/lib/slotAvailability';

const base: ComputeSlotsInput = {
  openMins: 8 * 60, closeMins: 12 * 60, durationMins: 60, isToday: false, nowMins: 0, reservations: [], blocks: [],
};
const states = (i: Partial<ComputeSlotsInput>) => Object.fromEntries(computeSlots({ ...base, ...i }).map((s) => [s.start, s.state]));

test.describe('computeSlots', () => {
  test('lists 30-minute starts inside operating hours, excluding starts whose duration runs past closing', () => {
    expect(computeSlots(base).map((s) => s.start)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(computeSlots({ ...base, durationMins: 90 }).map((s) => s.start).at(-1)).toBe('10:30');
  });
  test('a reservation marks every start whose duration overlaps it as reserved (kept visible)', () => {
    const s = states({ reservations: [{ start_time: '09:00:00', end_time: '10:00:00' }] });
    expect(s['08:00']).toBe('available');
    expect(s['08:30']).toBe('reserved'); // 08:30-09:30 overlaps
    expect(s['09:00']).toBe('reserved');
    expect(s['09:30']).toBe('reserved');
    expect(s['10:00']).toBe('available'); // back-to-back is fine
  });
  test('90-minute booking overlapping a reservation or block is not selectable', () => {
    const r = computeSlots({ ...base, openMins: 8 * 60, closeMins: 14 * 60, durationMins: 90, reservations: [{ start_time: '10:00', end_time: '11:00' }] });
    expect(r.find((x) => x.start === '09:00')?.state).toBe('reserved'); // 09:00-10:30 hits 10:00
    expect(r.find((x) => x.start === '08:30')?.state).toBe('available'); // 08:30-10:00 ends exactly at the start
    const b = computeSlots({ ...base, openMins: 8 * 60, closeMins: 14 * 60, durationMins: 90, blocks: [{ start_time: '11:00', end_time: '12:00' }] });
    expect(isSelectable(b.find((x) => x.start === '10:00'))).toBe(false);
    expect(isSelectable(b.find((x) => x.start === '12:00'))).toBe(true);
  });
  test('blocked wins over reserved; mine is flagged only for starts INSIDE the residents own reservation', () => {
    const both = states({ reservations: [{ start_time: '09:00', end_time: '10:00' }], blocks: [{ start_time: '09:00', end_time: '10:00' }] });
    expect(both['09:00']).toBe('blocked');
    const mine = computeSlots({ ...base, reservations: [{ start_time: '09:00', end_time: '10:00', isMine: true }] }).find((x) => x.start === '09:00');
    expect(mine).toMatchObject({ state: 'reserved', mine: true, inside: true });
    const adj = computeSlots({ ...base, reservations: [{ start_time: '09:00', end_time: '09:30', isMine: true }, { start_time: '09:30', end_time: '10:00' }] });
    expect(adj.find((x) => x.start === '09:00')?.mine).toBe(true);   // starts inside my 09:00-09:30
    expect(adj.find((x) => x.start === '09:30')?.mine).toBe(false);  // starts inside someone else's 09:30-10:00
  });
  test('REGRESSION: a 90 minute reservation of mine is "Yours" for exactly 90 minutes of half-hour starts, not more', () => {
    const slots = computeSlots({
      openMins: 8 * 60, closeMins: 14 * 60, durationMins: 90, isToday: false, nowMins: 0, blocks: [],
      reservations: [{ start_time: '10:00:00', end_time: '11:30:00', isMine: true }],
    });
    const yours = slots.filter((x) => x.mine).map((x) => x.start);
    expect(yours).toEqual(['10:00', '10:30', '11:00']);          // 3 half-hour cells = 90 minutes
    const overlaps = slots.filter((x) => x.state === 'reserved' && !x.mine).map((x) => x.start);
    expect(overlaps).toEqual(['09:00', '09:30']);                // unavailable because a 90 minute booking would run into it...
    expect(slots.filter((x) => x.inside === false).every((x) => x.mine === false)).toBe(true); // ...but they are not "Yours"
    expect(slots.find((x) => x.start === '08:30')?.state).toBe('available'); // ends exactly at 10:00
    expect(slots.find((x) => x.start === '11:30')?.state).toBe('available'); // starts exactly at the end
  });
  test('someone elses reservation is never "Yours"', () => {
    const slots = computeSlots({ ...base, reservations: [{ start_time: '09:00', end_time: '10:00', isMine: false }] });
    expect(slots.filter((x) => x.mine)).toHaveLength(0);
  });
  test('past times are hidden today but nothing is hidden on other days', () => {
    expect(computeSlots({ ...base, isToday: true, nowMins: 9 * 60 }).map((s) => s.start)[0]).toBe('09:30');
    expect(computeSlots({ ...base, isToday: false, nowMins: 11 * 60 }).map((s) => s.start)[0]).toBe('08:00');
  });
  test('selected-slot revalidation sees a booking made after the sheet opened', () => {
    expect(revalidateSelection('09:00', base)).toBe('available');
    expect(revalidateSelection('09:00', { ...base, reservations: [{ start_time: '09:30', end_time: '10:30' }] })).toBe('reserved');
    expect(revalidateSelection('09:00', { ...base, blocks: [{ start_time: '08:00', end_time: '12:00' }] })).toBe('blocked');
    expect(revalidateSelection('15:00', base)).toBe('gone');
  });
});

test.describe('toDateKey', () => {
  test('uses the local calendar day (an evening local time is not shifted to the next UTC day)', () => {
    expect(toDateKey(new Date(2026, 9, 30, 22, 30))).toBe('2026-10-30');
    expect(toDateKey(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});

test.describe('half-hour operating times (admin TimePicker allows them)', () => {
  test('08:30-12:30 offers 08:30 first and 11:30 last for a 60 minute booking', () => {
    const r = computeSlots({ ...base, openMins: 8 * 60 + 30, closeMins: 12 * 60 + 30 });
    expect(r[0].start).toBe('08:30');
    expect(r.at(-1)?.start).toBe('11:30');
    expect(r.some((x) => x.start === '08:00')).toBe(false);
  });
  test('a 90 minute booking cannot start after 11:00 when closing at 12:30', () => {
    const r = computeSlots({ ...base, openMins: 8 * 60 + 30, closeMins: 12 * 60 + 30, durationMins: 90 });
    expect(r.at(-1)?.start).toBe('11:00');
  });
  test('revalidation uses the same minute-precise hours', () => {
    expect(revalidateSelection('11:30', { ...base, openMins: 8 * 60 + 30, closeMins: 12 * 60 + 30 })).toBe('available');
    expect(revalidateSelection('08:00', { ...base, openMins: 8 * 60 + 30, closeMins: 12 * 60 + 30 })).toBe('gone');
  });
});

test.describe('server-enforced limits are reflected (enforce_amenity_booking_rules)', () => {
  const mine = [{ start_time: '08:00', end_time: '09:00', isMine: true }];
  test('resident already at the daily cap: every otherwise-open time becomes non-selectable (limit)', () => {
    const r = computeSlots({ ...base, reservations: mine, limits: { maxPerDay: 1 } });
    expect(r.filter((x) => x.state === 'available')).toHaveLength(0);
    expect(r.find((x) => x.start === '10:00')?.state).toBe('limit');
    expect(r.find((x) => x.start === '08:00')?.state).toBe('reserved'); // their own booking stays labelled
    expect(limitReason({ ...base, reservations: mine, limits: { maxPerDay: 1 } })).toBe('daily');
  });
  test('below the cap nothing changes; someone elses booking does not count against the resident', () => {
    expect(computeSlots({ ...base, reservations: mine, limits: { maxPerDay: 2 } }).some((x) => x.state === 'available')).toBe(true);
    const others = [{ start_time: '08:00', end_time: '09:00', isMine: false }];
    expect(limitReason({ ...base, reservations: others, limits: { maxPerDay: 1 } })).toBeNull();
  });
  test('configured duration above max_duration_minutes is not offered', () => {
    expect(limitReason({ ...base, durationMins: 90, limits: { maxDurationMins: 60 } })).toBe('duration');
    expect(computeSlots({ ...base, durationMins: 90, limits: { maxDurationMins: 60 } }).some((x) => x.state === 'available')).toBe(false);
    expect(limitReason({ ...base, durationMins: 60, limits: { maxDurationMins: 60 } })).toBeNull();
  });
  test('null/undefined limits mean unlimited', () => {
    expect(limitReason({ ...base, limits: { maxPerDay: null, maxDurationMins: null } })).toBeNull();
    expect(limitReason(base)).toBeNull();
  });
});
