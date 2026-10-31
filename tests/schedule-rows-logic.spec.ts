/**
 * "View Schedule" rows: 30 minute cells, one merged row per reservation, own reservations distinguishable.
 * Node only:  npx playwright test -c playwright.logic.config.ts schedule-rows
 */
import { test, expect } from '@playwright/test';
import { buildScheduleRows } from '../src/lib/scheduleRows';

const open = 8 * 60, close = 14 * 60;
const me = 'user-me', other = 'user-other';

test.describe('buildScheduleRows', () => {
  test('REGRESSION: a 90 minute reservation of mine is ONE 90 minute "mine" row, not two hour rows', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '10:00:00', end_time: '11:30:00', user_id: me }] });
    const mine = rows.filter((r) => r.type === 'mine');
    expect(mine).toEqual([{ start: '10:00', end: '11:30', type: 'mine' }]);
    expect(rows.find((r) => r.start === '09:30')?.type).toBe('available');
    expect(rows.find((r) => r.start === '11:30')?.type).toBe('available');
  });
  test('mine and other residents bookings are different types, even back to back', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:00', end_time: '10:00', user_id: other }, { start_time: '10:00', end_time: '11:00', user_id: me }] });
    expect(rows.filter((r) => r.type !== 'available')).toEqual([
      { start: '09:00', end: '10:00', type: 'booked' },
      { start: '10:00', end: '11:00', type: 'mine' },
    ]);
  });
  test('two separate bookings by the same person back to back stay two rows', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:00', end_time: '10:00', user_id: me }, { start_time: '10:00', end_time: '11:00', user_id: me }] });
    expect(rows.filter((r) => r.type === 'mine')).toHaveLength(2);
  });
  test('maintenance wins over a booking and is one row', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me,
      maintenance: [{ start_time: '12:00', end_time: '13:00' }], bookings: [{ start_time: '12:00', end_time: '13:00', user_id: me }] });
    expect(rows.filter((r) => r.type === 'maintenance')).toEqual([{ start: '12:00', end: '13:00', type: 'maintenance' }]);
    expect(rows.some((r) => r.type === 'mine')).toBe(false);
  });
  test('with no signed-in user nothing is "mine"; empty day is all available 30 minute rows', () => {
    const none = buildScheduleRows({ openMins: open, closeMins: close, userId: null, maintenance: [], bookings: [{ start_time: '09:00', end_time: '10:00', user_id: me }] });
    expect(none.some((r) => r.type === 'mine')).toBe(false);
    const empty = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [], bookings: [] });
    expect(empty).toHaveLength(12);
    expect(empty.every((r) => r.type === 'available')).toBe(true);
  });
  test('half-hour operating hours are honoured', () => {
    const rows = buildScheduleRows({ openMins: 8 * 60 + 30, closeMins: 11 * 60 + 30, userId: me, maintenance: [], bookings: [] });
    expect(rows[0].start).toBe('08:30');
    expect(rows.at(-1)?.end).toBe('11:30');
  });
});

import { durationLabel, relativeDay } from '../src/lib/reservations';

test.describe('My Reservations upcoming helpers', () => {
  const now = new Date(2026, 9, 31, 15, 30);
  test('relativeDay: Today / Tomorrow / In N days, nothing for far or past dates', () => {
    expect(relativeDay('2026-10-31', now)).toBe('Today');
    expect(relativeDay('2026-11-01', now)).toBe('Tomorrow');
    expect(relativeDay('2026-11-04', now)).toBe('In 4 days');
    expect(relativeDay('2026-11-07', now)).toBeNull();
    expect(relativeDay('2026-10-30', now)).toBeNull();
  });
  test('relativeDay crosses month and year boundaries', () => {
    expect(relativeDay('2027-01-01', new Date(2026, 11, 31, 23, 0))).toBe('Tomorrow');
  });
  test('durationLabel', () => {
    expect(durationLabel('10:00:00', '11:30:00')).toBe('1 h 30 min');
    expect(durationLabel('10:00', '11:00')).toBe('1 h');
    expect(durationLabel('10:00', '10:30')).toBe('30 min');
    expect(durationLabel('11:00', '10:00')).toBe('0 min');
  });
});
