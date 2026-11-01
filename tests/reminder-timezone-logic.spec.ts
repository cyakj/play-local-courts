/**
 * Booking reminders and the manager portfolio use the COMMUNITY's zone, never UTC, the phone's zone or a hard-coded Puerto Rico.
 * Node only:  npx playwright test -c playwright.logic.config.ts reminder-timezone
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bookingStartMs, candidateDates, inWindow, localToUtcMs as fnLocalToUtc } from '../supabase/functions/_shared/reminderWindow';
import { localToUtcMs, earliestCommunityToday, communityToday } from '../src/lib/communityTime';

const min = (n: number) => n * 60_000;

test.describe('reminder window uses the HOA zone', () => {
  test('the edge copy of the zone math equals the app version (DST and 30-minute zones included)', () => {
    for (const [d, t, z] of [
      ['2026-11-05', '10:00:00', 'America/Puerto_Rico'], ['2026-11-05', '10:00:00', 'America/Los_Angeles'],
      ['2026-03-08', '03:00:00', 'America/New_York'], ['2026-11-01', '09:00:00', 'America/New_York'],
      ['2026-04-05', '10:30:00', 'Australia/Lord_Howe'], ['2026-07-01', '08:00:00', 'Asia/Kolkata'],
    ] as const) expect(fnLocalToUtc(d, t, z)).toBe(localToUtcMs(d, t, z));
  });

  test('a 10:00 booking is 10:00 at ITS community, not at UTC', () => {
    expect(new Date(bookingStartMs('2026-11-05', '10:00:00', 'America/Los_Angeles')!).toISOString()).toBe('2026-11-05T18:00:00.000Z');
    expect(new Date(bookingStartMs('2026-11-05', '10:00:00', 'America/Puerto_Rico')!).toISOString()).toBe('2026-11-05T14:00:00.000Z');
    expect(new Date(bookingStartMs('2026-11-05', '10:00:00', 'America/New_York')!).toISOString()).toBe('2026-11-05T15:00:00.000Z');
  });

  test('1-hour reminder fires one hour before the HOA-local start for California, New York and Puerto Rico', () => {
    for (const [zone, utcStart] of [
      ['America/Los_Angeles', '2026-11-05T18:00:00Z'], ['America/New_York', '2026-11-05T15:00:00Z'], ['America/Puerto_Rico', '2026-11-05T14:00:00Z'],
    ] as const) {
      const now = new Date(utcStart).getTime() - min(60);
      expect(inWindow(bookingStartMs('2026-11-05', '10:00:00', zone), new Date(now + min(55)), new Date(now + min(65)))).toBe(true);
    }
    // the OLD code read 10:00 as UTC: for a California HOA that is 8 hours away from the real start
    const real = bookingStartMs('2026-11-05', '10:00:00', 'America/Los_Angeles')!;
    expect(real - Date.parse('2026-11-05T10:00:00Z')).toBe(8 * 3_600_000);
  });

  test('a booking outside the window is not reminded; the 24h window crosses the UTC date line correctly', () => {
    const start = bookingStartMs('2026-11-05', '20:00:00', 'America/Los_Angeles')!; // 04:00Z on 11-06
    const now = start - min(24 * 60);
    expect(inWindow(start, new Date(now + min(1415)), new Date(now + min(1445)))).toBe(true);
    expect(inWindow(start, new Date(now + min(1450)), new Date(now + min(1470)))).toBe(false);
    expect(candidateDates(new Date(now + min(1415)), new Date(now + min(1445)))).toContain('2026-11-05');
  });

  test('a community without a zone is never guessed; a legacy server (no column) uses Puerto Rico', () => {
    expect(bookingStartMs('2026-11-05', '10:00:00', null)).toBeNull();
    expect(bookingStartMs('2026-11-05', '10:00:00', 'Not/AZone')).toBeNull();
    expect(inWindow(null, new Date(0), new Date(9e12))).toBe(false);
    expect(bookingStartMs('2026-11-05', '10:00:00', undefined, true)).toBe(localToUtcMs('2026-11-05', '10:00:00', 'America/Puerto_Rico'));
  });

  test('the reminder function uses the shared helper and no UTC parsing of booking times', () => {
    const src = readFileSync('supabase/functions/send-scheduled-reminders/index.ts', 'utf8');
    const fn = src.slice(src.indexOf('async function processBookingReminders'), src.indexOf('async function processLessonReminders'));
    expect(fn).toContain('bookingStartMs(');
    expect(fn).toContain('candidateDates(');
    expect(fn).not.toMatch(/new Date\(`\$\{booking\.date\}T/);
    expect(fn).not.toContain("toISOString().split('T')[0]");
  });
});

test.describe('manager portfolio uses each community zone', () => {
  test('earliestCommunityToday is a safe lower bound across zones', () => {
    const now = new Date('2026-11-06T02:00:00Z'); // PR 11-05 22:00, LA 11-05 18:00, Auckland 11-06 15:00
    expect(communityToday(now, 'America/Puerto_Rico')).toBe('2026-11-05');
    expect(communityToday(now, 'Pacific/Auckland')).toBe('2026-11-06');
    expect(earliestCommunityToday(['America/Puerto_Rico', 'Pacific/Auckland', 'America/Los_Angeles'], now)).toBe('2026-11-05');
    expect(earliestCommunityToday(['Pacific/Auckland'], now)).toBe('2026-11-06');
    expect(earliestCommunityToday([], now)).toBe(communityToday(now));
  });

  test('(cm) screens no longer use the Puerto Rico default for "today" or urgency', () => {
    for (const f of ['alerts', 'index', 'calendar', 'community/[hoaId]']) {
      const src = readFileSync(`src/app/(cm)/${f}.tsx`, 'utf8');
      expect(src, f).not.toMatch(/communityToday\(\)/);
      expect(src, f).toContain('loadHoaZones');
    }
    expect(readFileSync('src/app/(cm)/alerts.tsx', 'utf8')).not.toMatch(/hoursUntilStart\(b\.date, b\.start_time\)/);
  });
});
