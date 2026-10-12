/**
 * Pure tests for community-time math and the reservation cancellation / status rules.
 * Runs in Node (no browser, no network).
 */
import { test, expect } from '@playwright/test';
import { communityToday, hoursUntilStart, formatDuration } from '../src/lib/communityTime';
import { cancellationState, isUpcoming, statusDisplay } from '../src/lib/reservations';

// Puerto Rico is UTC-4 year-round (no DST).
const at = (iso: string) => new Date(iso);

test.describe('community time (America/Puerto_Rico)', () => {
  test('communityToday uses the community date, not UTC', () => {
    // 2026-10-13 02:30 UTC == 2026-10-12 22:30 in Puerto Rico
    expect(communityToday(at('2026-10-13T02:30:00Z'))).toBe('2026-10-12');
    expect(communityToday(at('2026-10-12T04:00:00Z'))).toBe('2026-10-12'); // midnight PR
    expect(communityToday(at('2026-10-12T03:59:00Z'))).toBe('2026-10-11');
  });

  test('hoursUntilStart compares wall-clock to community now', () => {
    // 2026-10-12 12:00 UTC == 08:00 PR. A 13:00 PR booking is 5h away.
    expect(hoursUntilStart('2026-10-12', '13:00:00', at('2026-10-12T12:00:00Z'))).toBeCloseTo(5, 5);
    // 21:00 PR now (01:00Z next day); a 22:00 PR booking is 1h away (UTC math would say 21h ahead / -3h).
    expect(hoursUntilStart('2026-10-12', '22:00:00', at('2026-10-13T01:00:00Z'))).toBeCloseTo(1, 5);
  });

  test('independent of the device timezone', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(hoursUntilStart('2026-10-12', '13:00:00', at('2026-10-12T12:00:00Z'))).toBeCloseTo(5, 5);
    } finally {
      if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
    }
  });

  test('formatDuration', () => {
    expect(formatDuration(0.5)).toBe('30 min');
    expect(formatDuration(5)).toBe('5 h');
    expect(formatDuration(5.5)).toBe('5 h 30 min');
    expect(formatDuration(26)).toBe('1 day 2 h');
  });
});

test.describe('cancellationState (24h window)', () => {
  const now = at('2026-10-12T12:00:00Z'); // 08:00 PR
  const base = { status: 'confirmed', minHours: 24, now };

  test('allowed when the start is beyond the window', () => {
    expect(cancellationState({ ...base, date: '2026-10-13', startTime: '10:00:00' }).canCancel).toBe(true);
  });
  test('blocked inside the window, with a resident-readable reason', () => {
    const s = cancellationState({ ...base, date: '2026-10-13', startTime: '07:00:00' }); // 23h away
    expect(s.canCancel).toBe(false);
    expect(s.reason).toMatch(/24 hours before the start time/);
    expect(s.reason).toMatch(/starts in 23 h/);
    expect(s.short).toBe('Closed 24h before start');
  });
  test('boundary: exactly at the cutoff is still cancellable', () => {
    expect(cancellationState({ ...base, date: '2026-10-13', startTime: '08:00:00' }).canCancel).toBe(true);
  });
  test('already started', () => {
    const s = cancellationState({ ...base, date: '2026-10-12', startTime: '07:00:00' });
    expect(s.canCancel).toBe(false);
    expect(s.short).toBe('Started');
  });
  test('pending requests follow the same rule; cancelled/rejected are not actionable', () => {
    expect(cancellationState({ ...base, status: 'pending', date: '2026-10-14', startTime: '09:00:00' }).canCancel).toBe(true);
    expect(cancellationState({ ...base, status: 'cancelled', date: '2026-10-14', startTime: '09:00:00' })).toEqual({ canCancel: false });
    expect(cancellationState({ ...base, status: 'rejected', date: '2026-10-14', startTime: '09:00:00' })).toEqual({ canCancel: false });
  });
  test('uses the configured window (2h)', () => {
    expect(cancellationState({ ...base, minHours: 2, date: '2026-10-12', startTime: '11:00:00' }).canCancel).toBe(true);
    expect(cancellationState({ ...base, minHours: 2, date: '2026-10-12', startTime: '09:30:00' }).canCancel).toBe(false);
  });
});

test.describe('status presentation', () => {
  test('pending / confirmed / rejected / cancelled all have distinct labels', () => {
    const labels = ['pending', 'confirmed', 'rejected', 'cancelled'].map((s) => statusDisplay(s).label);
    expect(new Set(labels).size).toBe(4);
    expect(statusDisplay('pending').description).toMatch(/requires approval/);
  });
  test('isUpcoming: past, cancelled and rejected drop out of upcoming', () => {
    const now = at('2026-10-12T12:00:00Z');
    expect(isUpcoming('confirmed', '2026-10-12', '17:00:00', now)).toBe(true);
    expect(isUpcoming('confirmed', '2026-10-12', '07:00:00', now)).toBe(false);
    expect(isUpcoming('cancelled', '2026-10-14', '09:00:00', now)).toBe(false);
    expect(isUpcoming('rejected', '2026-10-14', '09:00:00', now)).toBe(false);
    expect(isUpcoming('pending', '2026-10-14', '09:00:00', now)).toBe(true);
  });
});
