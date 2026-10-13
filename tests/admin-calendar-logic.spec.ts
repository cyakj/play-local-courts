/**
 * Pure logic tests for the admin calendar (src/lib/adminCalendar.ts). Imports the real module.
 *   npx playwright test -c playwright.logic.config.ts
 */
import { test, expect } from '@playwright/test';
import {
  addDays, addMonths, buildMonthWeeks, communityWallToIso, dayOfWeek, dedupeEvents, eachDate, expandBlockout,
  filterEvents, groupByDate, isoToCommunityWall, weekOf, type CalendarEvent,
} from '../src/lib/adminCalendar';

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', hoaId: 'h1', community: 'The Greens', type: 'community_event', title: 'Mixer',
  date: '2026-10-13', startTime: '10:00', endTime: null, location: '', ...over,
});

test.describe('month grid', () => {
  test('every row is 7 cells and weekdays align with dates (Sunday-first)', () => {
    for (const [y, m] of [[2026, 2], [2026, 10], [2027, 2], [2026, 12], [2028, 2]] as const) {
      const weeks = buildMonthWeeks(y, m);
      for (const w of weeks) {
        expect(w).toHaveLength(7);
        w.forEach((c, i) => expect(dayOfWeek(c.date)).toBe(i));
      }
    }
  });

  test('contains every day of the month exactly once as inMonth, with no gaps', () => {
    const weeks = buildMonthWeeks(2026, 10).flat();
    const inMonth = weeks.filter((c) => c.inMonth).map((c) => c.day);
    expect(inMonth).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    // consecutive dates across the whole grid
    for (let i = 1; i < weeks.length; i++) expect(weeks[i].date).toBe(addDays(weeks[i - 1].date, 1));
  });

  test('handles a 4-week February and a 6-week month', () => {
    expect(buildMonthWeeks(2026, 2)).toHaveLength(4);   // Feb 2026 starts on Sunday, 28 days
    expect(buildMonthWeeks(2026, 8)).toHaveLength(6);   // Aug 2026 starts on Saturday, 31 days
  });

  test('leading and trailing cells come from adjacent months and are not inMonth', () => {
    const oct = buildMonthWeeks(2026, 10);
    expect(oct[0][0].date).toBe('2026-09-27');
    expect(oct[0][0].inMonth).toBe(false);
    expect(oct[oct.length - 1][6].date).toBe('2026-10-31'); // Oct 31 is a Saturday: no trailing cells
    expect(oct[oct.length - 1][6].inMonth).toBe(true);
    const nov = buildMonthWeeks(2026, 11);               // Nov 30 is a Monday: trailing Dec 1-5
    expect(nov[nov.length - 1][6].date).toBe('2026-12-05');
    expect(nov[nov.length - 1][6].inMonth).toBe(false);
  });
});

test.describe('date arithmetic', () => {
  test('addDays crosses month and year boundaries and leap day', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
  test('addMonths returns the first of the target month', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });
  test('weekOf spans Sunday..Saturday around the date', () => {
    expect(weekOf('2026-10-13')).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  });
  test('eachDate is inclusive and capped', () => {
    expect(eachDate('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(eachDate('2026-01-01', '2030-01-01', 10)).toHaveLength(10);
    expect(eachDate('2026-02-02', '2026-02-01')).toEqual([]);
  });
});

test.describe('community timezone (America/Puerto_Rico, UTC-4, no DST)', () => {
  test('wall clock -> UTC instant', () => {
    expect(communityWallToIso('2026-10-13', '10:00')).toBe('2026-10-13T14:00:00.000Z');
    expect(communityWallToIso('2026-01-15', '23:30')).toBe('2026-01-16T03:30:00.000Z'); // crosses UTC midnight
  });
  test('UTC instant -> community date/time, including the previous-day case', () => {
    expect(isoToCommunityWall('2026-10-13T14:00:00.000Z')).toEqual({ date: '2026-10-13', time: '10:00' });
    expect(isoToCommunityWall('2026-10-14T02:00:00.000Z')).toEqual({ date: '2026-10-13', time: '22:00' });
  });
  test('round trips, and does not shift across a DST zone transition (US Eastern check)', () => {
    for (const t of ['00:00', '09:15', '23:59']) {
      expect(isoToCommunityWall(communityWallToIso('2026-06-01', t))).toEqual({ date: '2026-06-01', time: t });
    }
    // The helper is zone-parametric: in a DST zone the offset changes across the spring-forward date.
    const winter = communityWallToIso('2026-03-07', '12:00', 'America/New_York');
    const summer = communityWallToIso('2026-03-09', '12:00', 'America/New_York');
    expect(winter).toBe('2026-03-07T17:00:00.000Z');
    expect(summer).toBe('2026-03-09T16:00:00.000Z');
  });
});

test.describe('events', () => {
  test('groupByDate sorts by start time and keeps days separate', () => {
    const g = groupByDate([ev({ id: 'a', startTime: '15:00' }), ev({ id: 'b', startTime: '09:00' }), ev({ id: 'c', date: '2026-10-14' })]);
    expect(g.get('2026-10-13')!.map((e) => e.id)).toEqual(['b', 'a']);
    expect(g.get('2026-10-14')!.map((e) => e.id)).toEqual(['c']);
  });

  test('dedupeEvents drops repeated ids but keeps distinct events', () => {
    expect(dedupeEvents([ev(), ev(), ev({ id: 'e2' })]).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  test('filterEvents combines community and type filters', () => {
    const all = [ev(), ev({ id: 'e2', type: 'blockout' }), ev({ id: 'e3', hoaId: 'h2' })];
    expect(filterEvents(all, { hoaId: 'all', types: 'all' })).toHaveLength(3);
    expect(filterEvents(all, { hoaId: 'h1', types: 'all' })).toHaveLength(2);
    expect(filterEvents(all, { hoaId: 'h1', types: new Set(['blockout'] as const) }).map((e) => e.id)).toEqual(['e2']);
  });

  test('expandBlockout makes one entry per day, clipped to the visible window', () => {
    const b = { id: 'm1', hoaId: 'h1', community: 'The Greens', courtName: 'Court 1', date: '2026-10-29', endDate: '2026-11-02',
      startTime: '08:00:00', endTime: '12:00:00', description: 'Resurfacing' };
    expect(expandBlockout(b, { from: '2026-09-27', to: '2026-10-31' }).map((e) => e.date)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(expandBlockout(b, { from: '2026-11-01', to: '2026-11-30' }).map((e) => e.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(expandBlockout(b, { from: '2026-12-01', to: '2026-12-31' })).toEqual([]);
    const one = expandBlockout({ ...b, endDate: null }, { from: '2026-10-01', to: '2026-10-31' });
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ type: 'blockout', startTime: '08:00', endTime: '12:00' });
    expect(new Set(expandBlockout(b, { from: '2026-10-01', to: '2026-11-30' }).map((e) => e.id)).size).toBe(5);
  });
});
