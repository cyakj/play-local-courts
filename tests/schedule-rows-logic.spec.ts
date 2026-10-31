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
    expect(mine).toEqual([{ start: '10:00', end: '11:30', type: 'mine', onGrid: true }]);
    expect(rows.find((r) => r.start === '09:30')?.type).toBe('available');
    expect(rows.find((r) => r.start === '11:30')?.type).toBe('available');
  });
  test('mine and other residents bookings are different types, even back to back', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:00', end_time: '10:00', user_id: other }, { start_time: '10:00', end_time: '11:00', user_id: me }] });
    expect(rows.filter((r) => r.type !== 'available')).toEqual([
      { start: '09:00', end: '10:00', type: 'booked', onGrid: true },
      { start: '10:00', end: '11:00', type: 'mine', onGrid: true },
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
    expect(rows.filter((r) => r.type === 'maintenance')).toEqual([{ start: '12:00', end: '13:00', type: 'maintenance', onGrid: true }]);
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

test.describe('buildScheduleRows: off-grid times (Codex finding)', () => {
  test('REGRESSION: 09:15-10:15 is shown as 09:15-10:15, not rounded out to 09:00-10:30', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:15', end_time: '10:15', user_id: me }] });
    expect(rows.filter((r) => r.type === 'mine')).toEqual([{ start: '09:15', end: '10:15', type: 'mine', onGrid: false }]);
    // open time either side is split at the booking edge, never swallowed
    expect(rows.find((r) => r.end === '09:15')?.type).toBe('available');
    expect(rows.find((r) => r.start === '10:15')?.type).toBe('available');
  });
  test('adjacent off-grid bookings by different people share a cell without order-dependent results', () => {
    const a = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:00', end_time: '09:15', user_id: other }, { start_time: '09:15', end_time: '09:30', user_id: me }] });
    const b = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:15', end_time: '09:30', user_id: me }, { start_time: '09:00', end_time: '09:15', user_id: other }] });
    expect(a).toEqual(b);
    expect(a.filter((r) => r.type !== 'available').map((r) => [r.start, r.end, r.type])).toEqual([['09:00', '09:15', 'booked'], ['09:15', '09:30', 'mine']]);
  });
  test('a non-aligned closing time keeps its last partial row', () => {
    const rows = buildScheduleRows({ openMins: 8 * 60, closeMins: 9 * 60 + 15, userId: me, maintenance: [], bookings: [] });
    expect(rows.at(-1)).toEqual({ start: '09:00', end: '09:15', type: 'available', onGrid: true });
  });
  test('overlapping pending bookings resolve by precedence: maintenance > mine > booked', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [],
      bookings: [{ start_time: '09:00', end_time: '10:00', user_id: other }, { start_time: '09:30', end_time: '10:30', user_id: me }] });
    expect(rows.find((r) => r.start === '09:30')?.type).toBe('mine');
    expect(rows.find((r) => r.start === '09:00')?.type).toBe('booked');
  });
  test('bookings outside operating hours are clamped, and an empty or inverted day yields no rows', () => {
    const rows = buildScheduleRows({ openMins: open, closeMins: close, userId: me, maintenance: [], bookings: [{ start_time: '07:00', end_time: '08:30', user_id: me }] });
    expect(rows[0]).toEqual({ start: '08:00', end: '08:30', type: 'mine', onGrid: true });
    expect(buildScheduleRows({ openMins: close, closeMins: open, userId: me, maintenance: [], bookings: [] })).toEqual([]);
  });
});

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
