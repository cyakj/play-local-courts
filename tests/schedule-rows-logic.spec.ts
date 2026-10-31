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
