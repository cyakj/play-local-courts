/**
 * Pure logic tests for the admin amenity schedule (src/lib/adminSchedule.ts).
 * Imports the real production module — no mirrors. Runs in Node only (no browser, no Supabase):
 *   npx playwright test -c playwright.logic.config.ts
 */
import { test, expect } from '@playwright/test';
import {
  buildSlots, formatMinutes, isSelectable, minutesToTime, overlaps, selectionRange, toMinutes, validateBlockout,
  type ScheduleBlockout, type ScheduleBooking,
} from '../src/lib/adminSchedule';

const booking = (over: Partial<ScheduleBooking> = {}): ScheduleBooking => ({
  id: 'b1', userId: 'u1', residentName: 'Ana', startTime: '09:00:00', endTime: '10:00:00', status: 'confirmed', ...over,
});
const blockout = (over: Partial<ScheduleBlockout> = {}): ScheduleBlockout => ({
  id: 'x1', startTime: '12:00:00', endTime: '14:00:00', description: 'Resurfacing', blockoutType: 'maintenance', ...over,
});
const base = { date: '2030-06-10', today: '2030-06-10', nowMinutes: 8 * 60, openMin: 6 * 60, closeMin: 12 * 60 };

test.describe('time helpers', () => {
  test('toMinutes / minutesToTime round trip and tolerate seconds', () => {
    expect(toMinutes('06:30')).toBe(390);
    expect(toMinutes('06:30:00')).toBe(390);
    expect(minutesToTime(390)).toBe('06:30:00');
    expect(minutesToTime(toMinutes('23:45:00'))).toBe('23:45:00');
  });
  test('formatMinutes uses 12-hour clock with noon/midnight handled', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(12 * 60)).toBe('12:00 PM');
    expect(formatMinutes(13 * 60 + 5)).toBe('1:05 PM');
  });
  test('overlaps is half-open: touching intervals do not overlap', () => {
    expect(overlaps(9, 10, 10, 11)).toBe(false);
    expect(overlaps(9, 10, 8, 9)).toBe(false);
    expect(overlaps(9, 11, 10, 12)).toBe(true);
    expect(overlaps(9, 12, 10, 11)).toBe(true);
  });
});

test.describe('buildSlots', () => {
  test('an empty future day is all available', () => {
    const slots = buildSlots({ ...base, date: '2030-06-11', bookings: [], blockouts: [] });
    expect(slots).toHaveLength(6);
    expect(slots.every((s) => s.state === 'available')).toBe(true);
    expect(slots.every(isSelectable)).toBe(true);
  });

  test('slots that already ended today are past; the current hour is not', () => {
    const slots = buildSlots({ ...base, nowMinutes: 8 * 60 + 30, bookings: [], blockouts: [] });
    expect(slots.map((s) => s.state)).toEqual(['past', 'past', 'available', 'available', 'available', 'available']);
  });

  test('every slot on a past date is past', () => {
    const slots = buildSlots({ ...base, date: '2030-06-09', bookings: [], blockouts: [] });
    expect(slots.every((s) => s.state === 'past')).toBe(true);
  });

  test('confirmed -> reserved, pending -> pending, with the resident attached', () => {
    const slots = buildSlots({
      ...base, date: '2030-06-11',
      bookings: [booking(), booking({ id: 'b2', startTime: '10:00:00', endTime: '11:00:00', status: 'pending', residentName: 'Luis' })],
      blockouts: [],
    });
    expect(slots[3].state).toBe('reserved');
    expect(slots[3].bookings[0].residentName).toBe('Ana');
    expect(slots[4].state).toBe('pending');
    expect(isSelectable(slots[3])).toBe(false);
    expect(isSelectable(slots[4])).toBe(false);
  });

  test('a 90-minute reservation marks both hours it touches', () => {
    const slots = buildSlots({
      ...base, date: '2030-06-11', bookings: [booking({ startTime: '09:30:00', endTime: '11:00:00' })], blockouts: [],
    });
    expect(slots.filter((s) => s.state === 'reserved').map((s) => s.startMin)).toEqual([9 * 60, 10 * 60]);
  });

  test('a blockout wins over a reservation and over past', () => {
    const slots = buildSlots({
      ...base, closeMin: 15 * 60, nowMinutes: 13 * 60,
      bookings: [booking({ startTime: '12:00:00', endTime: '13:00:00' })],
      blockouts: [blockout()],
    });
    const at = (h: number) => slots.find((s) => s.startMin === h * 60)!;
    expect(at(12).state).toBe('blocked'); // blocked, even though it also has a booking and is already past
    expect(at(13).state).toBe('blocked');
    expect(at(14).state).toBe('available');
  });

  test('two overlapping reservations in one slot keep both residents', () => {
    const slots = buildSlots({
      ...base, date: '2030-06-11',
      bookings: [booking({ status: 'pending' }), booking({ id: 'b2', residentName: 'Mia' })],
      blockouts: [],
    });
    expect(slots[3].bookings).toHaveLength(2);
    expect(slots[3].state).toBe('reserved'); // confirmed outranks pending
  });
});

test.describe('selection and validation', () => {
  const slots = buildSlots({ ...base, date: '2030-06-11', bookings: [], blockouts: [] });

  test('selectionRange covers the min start to the max end', () => {
    expect(selectionRange(slots, new Set())).toBeNull();
    expect(selectionRange(slots, new Set([8 * 60]))).toEqual({ start: 480, end: 540 });
    expect(selectionRange(slots, new Set([8 * 60, 10 * 60]))).toEqual({ start: 480, end: 660 });
  });

  const ok = { date: '2030-06-11', endDate: null, startMin: 480, endMin: 540, reason: 'Resurfacing', today: '2030-06-10' };
  test('valid input passes', () => expect(validateBlockout(ok)).toBeNull());
  test('rejects start >= end', () => {
    expect(validateBlockout({ ...ok, startMin: 540, endMin: 540 })).toMatch(/before end/i);
    expect(validateBlockout({ ...ok, startMin: 600, endMin: 540 })).toMatch(/before end/i);
  });
  test('rejects an end date before the start date', () => {
    expect(validateBlockout({ ...ok, endDate: '2030-06-10' })).toMatch(/end date/i);
  });
  test('rejects a blockout entirely in the past, allows one that ends today or later', () => {
    expect(validateBlockout({ ...ok, date: '2030-06-08', endDate: '2030-06-09' })).toMatch(/past/i);
    expect(validateBlockout({ ...ok, date: '2030-06-09', endDate: '2030-06-10' })).toBeNull();
  });
  test('requires a non-blank reason', () => {
    expect(validateBlockout({ ...ok, reason: '   ' })).toMatch(/reason/i);
  });
});
