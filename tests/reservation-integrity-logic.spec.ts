/**
 * Final reservation integrity (app side): HOA time zones, instant-based cancellation lead time, pending expiry at START,
 * server-side "current" filtering over >200 rows, copy, and static checks of the two new migrations.
 * Node only:  npx playwright test -c playwright.logic.config.ts reservation-integrity
 * (The database behaviour itself is proven by supabase/tests/reservation_integrity.sql through
 *  scripts/local-pg-rehearsal/rehearse-reservation-integrity.sh on a scratch restore.)
 */
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import {
  currentBookingsFilter, isCurrentReservation, reservationKind, selectCurrentReservations, toSlotReservation,
} from '../src/lib/reservationState';
import {
  deviceZoneDiffers, hoursUntilStart, isValidTimeZone, localToUtcMs, timeZoneLabel, tzOffsetMs,
} from '../src/lib/communityTime';
import { cancellationState, kindDescription, relativeDay, statusDisplay } from '../src/lib/reservations';

const z = (iso: string) => new Date(iso);
const PR = 'America/Puerto_Rico';
const LA = 'America/Los_Angeles';
const NY = 'America/New_York';

test.describe('HOA time zones decide every reservation time', () => {
  test('a New York resident sees a California reservation in California time', () => {
    // 18:00-19:00 at the California HOA on Oct 31. It is 17:30 in California (= 20:30 in Puerto Rico = 20:30 in New York EDT).
    const r = { status: 'confirmed', date: '2026-10-31', start_time: '18:00:00', end_time: '19:00:00' };
    const now = z('2026-11-01T00:30:00Z');
    expect(reservationKind(r, now, LA)).toBe('confirmed'); // upcoming at the HOA
    expect(reservationKind(r, now, PR)).toBe('completed'); // what a wrong (Puerto Rico / device) zone would claim
    expect(reservationKind(r, now, NY)).toBe('completed');
    expect(relativeDay('2026-10-31', now, LA)).toBe('Today');
    expect(hoursUntilStart('2026-10-31', '18:00:00', now, LA)).toBeCloseTo(0.5, 5);
  });
  test('a California resident booking a Puerto Rico HOA amenity: Puerto Rico time rules', () => {
    // 10:00 at the Puerto Rico HOA = 14:00Z. At 13:30Z it is 06:30 in LA but 09:30 at the HOA.
    const r = { status: 'confirmed', date: '2026-10-31', start_time: '10:00:00', end_time: '11:00:00' };
    expect(reservationKind(r, z('2026-10-31T13:30:00Z'), PR)).toBe('confirmed');
    expect(hoursUntilStart('2026-10-31', '10:00:00', z('2026-10-31T13:30:00Z'), PR)).toBeCloseTo(0.5, 5);
    expect(reservationKind(r, z('2026-10-31T14:30:00Z'), PR)).toBe('in_progress');
    expect(reservationKind(r, z('2026-10-31T14:30:00Z'), LA)).toBe('confirmed'); // wrong zone would say "not started"
  });
  test('the phone zone never matters (process TZ switched)', () => {
    const prev = process.env.TZ;
    for (const tz of ['Asia/Tokyo', 'Pacific/Auckland', 'America/Anchorage']) {
      process.env.TZ = tz;
      const r = { status: 'confirmed', date: '2026-10-31', start_time: '11:00:00', end_time: '12:00:00' };
      expect(reservationKind(r, z('2026-10-31T23:00:00Z'), PR)).toBe('completed');
      expect(reservationKind(r, z('2026-10-31T15:30:00Z'), PR)).toBe('in_progress');
    }
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  });
  test('cancellation lead time is measured between real instants across a daylight-saving change', () => {
    // New York spring forward: 2027-03-14 02:00 EST -> 03:00 EDT. A 04:00 EDT booking, "now" 01:30 EST (06:30Z): 1.5 real hours.
    const h = hoursUntilStart('2027-03-14', '04:00:00', z('2027-03-14T06:30:00Z'), NY);
    expect(h).toBeCloseTo(1.5, 5);
    // a two-hour minimum therefore blocks cancelling, where naive wall-clock subtraction (2.5 h) would allow it
    const s = cancellationState({ status: 'confirmed', date: '2027-03-14', startTime: '04:00:00', minHours: 2, now: z('2027-03-14T06:30:00Z'), timeZone: NY });
    expect(s.canCancel).toBe(false);
    // fall back: 2026-11-01, a 04:00 EST booking from 00:30 EDT (04:30Z) is 4.5 real hours away
    expect(hoursUntilStart('2026-11-01', '04:00:00', z('2026-11-01T04:30:00Z'), NY)).toBeCloseTo(4.5, 5);
  });
  test('localToUtcMs / tzOffsetMs agree with Intl for several zones', () => {
    expect(tzOffsetMs(z('2026-10-31T12:00:00Z').getTime(), PR)).toBe(-4 * 3_600_000);
    expect(tzOffsetMs(z('2026-10-31T12:00:00Z').getTime(), LA)).toBe(-7 * 3_600_000);
    expect(tzOffsetMs(z('2026-12-31T12:00:00Z').getTime(), LA)).toBe(-8 * 3_600_000);
    expect(localToUtcMs('2026-10-31', '10:00:00', LA)).toBe(z('2026-10-31T17:00:00Z').getTime());
    expect(localToUtcMs('2026-12-31', '10:00:00', NY)).toBe(z('2026-12-31T15:00:00Z').getTime());
  });
  test('zone labels and validation', () => {
    expect(timeZoneLabel(LA, z('2026-10-31T12:00:00Z'))).toMatch(/Pacific/);
    expect(isValidTimeZone('America/Puerto_Rico')).toBe(true);
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(typeof deviceZoneDiffers(PR)).toBe('boolean');
  });
});

test.describe('pending requests expire at their START', () => {
  const base = { date: '2026-10-31', start_time: '16:00:00', end_time: '17:00:00' };
  test('pending is current only before the start; in the booked hour it is expired, never "in progress"', () => {
    expect(reservationKind({ ...base, status: 'pending' }, z('2026-10-31T19:59:00Z'))).toBe('pending'); // 15:59 PR
    expect(reservationKind({ ...base, status: 'pending' }, z('2026-10-31T20:00:00Z'))).toBe('request_expired'); // 16:00 PR
    expect(reservationKind({ ...base, status: 'pending' }, z('2026-10-31T20:30:00Z'))).toBe('request_expired');
    expect(isCurrentReservation({ ...base, status: 'pending' }, z('2026-10-31T20:30:00Z'))).toBe(false);
    // a confirmed booking is still in progress in the same minute
    expect(reservationKind({ ...base, status: 'confirmed' }, z('2026-10-31T20:30:00Z'))).toBe('in_progress');
  });
  test('the stored status expired is history and never current', () => {
    expect(reservationKind({ ...base, status: 'expired' }, z('2026-10-30T00:00:00Z'))).toBe('request_expired');
    expect(isCurrentReservation({ ...base, status: 'expired' }, z('2026-10-30T00:00:00Z'))).toBe(false);
    expect(statusDisplay('expired').label).toBe('Request expired');
  });
  test('an expired pending request does not occupy the picker and no longer counts toward the daily cap (the insert-time sweep releases it)', () => {
    const r = toSlotReservation({ start_time: '16:00', end_time: '17:00', user_id: 'me', status: 'pending' }, '2026-10-31', 'me', z('2026-10-31T20:30:00Z'));
    expect(r).toMatchObject({ ended: true, isMine: false, ownForCap: false });
  });
  test('copy: a pending request HOLDS the time, is not confirmed, and says when it is released', () => {
    for (const d of [kindDescription('pending'), statusDisplay('pending').description]) {
      expect(d).toMatch(/held for you/);
      expect(d).toMatch(/declined|cancelled|not approved before the start/i);
      expect(d).not.toMatch(/not held/i);
    }
  });
});

test.describe('Home / My Reservations query: current rows come from the server, whatever else exists', () => {
  const now = z('2026-10-31T23:00:00Z'); // 19:00 PR on Oct 31
  const f = currentBookingsFilter(now, PR);

  test('the filter strings', () => {
    expect(f.today).toBe('2026-10-31');
    expect(f.or).toContain('and(status.eq.confirmed,date.eq.2026-10-31,end_time.gt.19:00:00)');
    expect(f.or).toContain('and(status.eq.pending,date.eq.2026-10-31,start_time.gt.19:00:00)');
    expect(f.or).toContain('and(status.eq.confirmed,date.gt.2026-10-31)');
  });

  // mini evaluator for exactly the PostgREST clauses the filter emits
  type Row = { id: string; user_id: string; status: string; date: string; start_time: string; end_time: string };
  const evalClause = (c: string, r: Row) => c.slice(4, -1).split(',').every((cond) => {
    const [col, op, ...rest] = cond.split('.'); const val = rest.join('.');
    const v = (r as unknown as Record<string, string>)[col];
    return op === 'eq' ? v === val : op === 'gt' ? v > val : false;
  });
  const serverFilter = (rows: Row[]) => rows.filter((r) => r.date >= f.today && f.or.split(/,(?=and\()/).some((c) => evalClause(c, r)));

  test('>200 rows: 600 historical + 300 other residents + 80 future of mine; the first page of 5 still holds my next booking', () => {
    const rows: Row[] = [];
    // many historical bookings of mine (confirmed, long over) and cancelled/rejected ones in the future
    for (let i = 0; i < 600; i++) rows.push({ id: `h${i}`, user_id: 'me', status: 'confirmed', date: `2025-0${1 + (i % 9)}-1${i % 9}`, start_time: '09:00:00', end_time: '10:00:00' });
    for (let i = 0; i < 40; i++) rows.push({ id: `c${i}`, user_id: 'me', status: i % 2 ? 'cancelled' : 'rejected', date: '2026-11-05', start_time: '08:00:00', end_time: '09:00:00' });
    // today: an ended confirmed one, an expired pending one, then the real next (pending, starts 20:00) and 80 more later
    rows.push({ id: 'ended', user_id: 'me', status: 'confirmed', date: '2026-10-31', start_time: '11:00:00', end_time: '12:00:00' });
    rows.push({ id: 'stalepending', user_id: 'me', status: 'pending', date: '2026-10-31', start_time: '18:00:00', end_time: '19:00:00' });
    rows.push({ id: 'next', user_id: 'me', status: 'pending', date: '2026-10-31', start_time: '20:00:00', end_time: '21:00:00' });
    for (let i = 0; i < 80; i++) rows.push({ id: `f${i}`, user_id: 'me', status: 'confirmed', date: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}`, start_time: '10:00:00', end_time: '11:00:00' });
    for (let i = 0; i < 300; i++) rows.push({ id: `o${i}`, user_id: 'someone-else', status: 'confirmed', date: '2026-10-31', start_time: '19:30:00', end_time: '20:30:00' });
    expect(rows.length).toBeGreaterThan(900);

    const mine = rows.filter((r) => r.user_id === 'me');
    const page = serverFilter(mine)
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)).slice(0, 5);
    expect(page[0].id).toBe('next');
    expect(page.some((r) => r.id === 'ended' || r.id === 'stalepending' || r.id.startsWith('h') || r.id.startsWith('c'))).toBe(false);
    // and the client re-check agrees
    expect(selectCurrentReservations(page, now, PR)[0].id).toBe('next');
    // the SAME answer as classifying every row on the client
    expect(selectCurrentReservations(mine, now, PR)[0].id).toBe('next');
    // upcoming total is exact (not capped at a page): everything current
    expect(serverFilter(mine).length).toBe(selectCurrentReservations(mine, now, PR).length);
  });

  test('the old retrieval (limit 200 over all of my rows from yesterday, oldest first, no end test) would have shown the ended booking', () => {
    const mine: Row[] = [
      { id: 'ended', user_id: 'me', status: 'confirmed', date: '2026-10-31', start_time: '11:00:00', end_time: '12:00:00' },
      { id: 'next', user_id: 'me', status: 'confirmed', date: '2026-11-02', start_time: '09:00:00', end_time: '10:00:00' },
    ];
    const old = mine.filter((r) => r.date >= '2026-10-31').sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))[0];
    expect(old.id).toBe('ended'); // the original bug
    expect(serverFilter(mine)[0].id).toBe('next');
  });
});

test.describe('static checks of the migrations and wiring', () => {
  const m1 = readFileSync('supabase/migrations/20261031100000_hoa_timezones.sql', 'utf8');
  const m2 = readFileSync('supabase/migrations/20261031110000_exclusive_pending_reservations.sql', 'utf8');
  test('M1: additive column, validation, backfill by evidence, no blanket Puerto Rico assignment', () => {
    expect(m1).toMatch(/ADD COLUMN IF NOT EXISTS timezone text/);
    expect(m1).toMatch(/validate_hoa_timezone/);
    expect(m1).toMatch(/WHERE timezone IS NULL\s+AND address ~\*/);
    expect(m1).not.toMatch(/UPDATE public\.hoas\s+SET timezone = 'America\/Puerto_Rico'\s*;/);
    expect(m1).toMatch(/hoa_timezone_for_court\(NEW\.court_id, TG_OP = 'INSERT'\)/);
    expect(m1).toMatch(/AT TIME ZONE public\.hoa_timezone_for_court\(OLD\.court_id, false\)\) < \(now\(\)/);
    expect(m1).not.toMatch(/AT TIME ZONE 'America\/Puerto_Rico'/);
    expect(m1).not.toMatch(/current_date \+/);
  });
  test('M2: exclusion covers pending + confirmed, aborts instead of altering data, expiry only via the trusted path', () => {
    expect(m2).toMatch(/WHERE \(status IN \('pending', 'confirmed'\)\)/);
    expect(m2).toMatch(/DROP CONSTRAINT IF EXISTS bookings_no_overlapping_confirmed/);
    expect(m2).toMatch(/Cannot apply: % pair\(s\)/);
    expect(m2).not.toMatch(/DELETE FROM public\.bookings/);
    expect(m2).toMatch(/current_setting\('app\.booking_expiry', true\)/);
    expect(m2).toMatch(/BEFORE INSERT ON public\.bookings/);
    expect(m2).toMatch(/REVOKE ALL ON FUNCTION public\.expire_pending_bookings\(uuid\) FROM PUBLIC, anon, authenticated/);
    expect(m2).toMatch(/get_amenity_busy_times/);
    expect(m2).not.toMatch(/user_id\s*,\s*b\.user_id/); // busy times never returns identities
  });
  test('the verification SQL and the rehearsal script exist and are wired to both migrations', () => {
    expect(existsSync('supabase/tests/reservation_integrity.sql')).toBe(true);
    const sh = readFileSync('scripts/local-pg-rehearsal/rehearse-reservation-integrity.sh', 'utf8');
    expect(sh).toContain('20261031100000_hoa_timezones.sql');
    expect(sh).toContain('20261031110000_exclusive_pending_reservations.sql');
    expect(sh).toMatch(/pre-flight/);
  });
  test('the Resident app reads availability through the busy-times function, never only the own-rows table', () => {
    const c = readFileSync('src/app/(resident)/courts.tsx', 'utf8');
    expect(c).toMatch(/get_amenity_busy_times/);
    // UI polish sprint: shorter wording, same two facts (others' bookings not visible yet; community zone label)
    expect(c).toMatch(/OTHERS_NOT_SHOWN_NOTE/);
    expect(readFileSync('src/lib/reservationCopy.ts', 'utf8')).toMatch(/Other residents' bookings aren't shown yet/);
    expect(c).toMatch(/This community's time zone is not set yet/);
    expect(c).toMatch(/Times in \$\{timeZoneLabel/);
  });
  test('My Reservations pages history on the server and keeps Upcoming complete', () => {
    const m = readFileSync('src/app/my-reservations.tsx', 'utf8');
    expect(m).toMatch(/currentBookingsFilter\(/);
    expect(m).toMatch(/\.range\(0, want - 1\)/);
    expect(m).toMatch(/Load older reservations/);
    expect(m).not.toMatch(/await query;/);
  });
  test('manager pending list: expiry per community zone and no silent cap', () => {
    const a = readFileSync('src/app/(admin)/pending-requests.tsx', 'utf8');
    expect(a).toMatch(/\.range\(from, from \+ 499\)/);
    expect(a).toMatch(/=== 'pending'/);
  });
});

test.describe('inspection round 1 follow-ups (RI-06..RI-11)', () => {
  const rd = (p: string) => readFileSync(p, 'utf8');
  test('RI-09: the app validator mirrors the database daylight-saving policy', async () => {
    const { reservationTimeProblem } = await import('../src/lib/communityTime');
    expect(reservationTimeProblem('2027-03-14', '02:30', '03:00', NY)).toBe('nonexistent');
    expect(reservationTimeProblem('2026-11-01', '01:30', '02:00', NY)).toBe('ambiguous');
    expect(reservationTimeProblem('2027-03-14', '01:30', '03:30', NY)).not.toBeNull();
    expect(reservationTimeProblem('2027-04-04', '01:45', '02:00', 'Australia/Lord_Howe')).not.toBeNull(); // 30 minute shift
    expect(reservationTimeProblem('2027-03-14', '10:00', '11:00', NY)).toBeNull();
    expect(reservationTimeProblem('2027-03-14', '02:30', '03:00', PR)).toBeNull();
    // the picker drops such starts
    const { computeSlots } = await import('../src/lib/slotAvailability');
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const slots = computeSlots({ openMins: 0, closeMins: 6 * 60, durationMins: 30, isToday: false, nowMins: 0, reservations: [], blocks: [],
      skipInterval: (s, e) => reservationTimeProblem('2027-03-14', hh(s), hh(e), NY) !== null });
    expect(slots.some((s) => s.start === '02:00' || s.start === '02:30')).toBe(false);
    expect(slots.some((s) => s.start === '03:00')).toBe(true);
  });
  test('RI-10: only a missing column may fall back to Puerto Rico', async () => {
    const { isMissingColumnError } = await import('../src/lib/communityTime');
    expect(isMissingColumnError({ code: '42703', message: 'column hoas.timezone does not exist' })).toBe(true);
    expect(isMissingColumnError({ message: 'Failed to fetch' })).toBe(false);
    expect(isMissingColumnError({ code: '42501', message: 'permission denied for table hoas' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
    expect(rd('src/hooks/useActiveCommunity.ts')).toMatch(/tzMissing \? COMMUNITY_TIME_ZONE : null/);
    expect(rd('src/hooks/useHoaTimeZone.ts')).toMatch(/isMissingColumnError\(res\.error\)/);
  });
  test('RI-07: an expired pending request no longer counts toward the daily limit (matches the insert-time sweep)', () => {
    const now = z('2026-10-31T20:30:00Z'); // 16:30 PR, request started 16:00
    const exp = toSlotReservation({ start_time: '16:00', end_time: '17:00', user_id: 'me', status: 'pending' }, '2026-10-31', 'me', now);
    expect(exp.ownForCap).toBe(false);
    const done = toSlotReservation({ start_time: '09:00', end_time: '10:00', user_id: 'me', status: 'confirmed' }, '2026-10-31', 'me', now);
    expect(done.ownForCap).toBe(true); // completed confirmed bookings still count
    expect(rd('supabase/migrations/20261031110000_exclusive_pending_reservations.sql')).toMatch(/counts_toward_cap/);
    expect(rd('supabase/migrations/20261031110000_exclusive_pending_reservations.sql')).toMatch(/NOT \(b\.status = 'pending' AND h\.timezone IS NOT NULL/);
  });
  test('RI-08: a late "load older" response for another account/community is discarded', () => {
    const m = rd('src/app/my-reservations.tsx');
    expect(m).toMatch(/scopeKey\.current !== myScope/);
    expect(m).toMatch(/scopeKey\.current = ''/);
  });
  test('RI-06: the second booking screen forwards to Reserve instead of creating reservations with the phone clock', () => {
    const a = rd('src/app/amenity-book.tsx');
    expect(a).toMatch(/export default function AmenityBookScreen\(\) \{\s*return <Redirect href="\/\(resident\)\/courts" \/>;/);
  });
  test('RI-11: manager amenity screen uses each community zone, the current predicate and pages to exhaustion', () => {
    const a = rd('src/app/(admin)/manage-amenities.tsx');
    expect(a).toMatch(/isCurrentReservation\(b, now,/);
    expect(a).toMatch(/\.range\(from, from \+ 499\)/);
    expect(a).not.toMatch(/communityToday\(\)/);
    expect(a).not.toMatch(/\.limit\(10\)\s*,\s*\n\s*supabase\s*\n\s*\.from\('bookings'\)/);
  });
});

test.describe('inspection round 2 follow-ups (RI-12..RI-15)', () => {
  const rd = (p: string) => readFileSync(p, 'utf8');
  test('RI-12: history is the exact complement of current, and its loader stays reachable', async () => {
    const { historyBookingsFilter } = await import('../src/lib/reservationState');
    const now = z('2026-10-31T23:00:00Z'); // 19:00 PR
    const h = historyBookingsFilter(now, PR);
    expect(h.or).toContain('status.in.(cancelled,rejected,expired)');
    expect(h.or).toContain('date.lt.2026-10-31');
    expect(h.or).toContain('and(status.eq.confirmed,date.eq.2026-10-31,end_time.lte.19:00:00)');
    expect(h.or).toContain('and(status.eq.pending,date.eq.2026-10-31,start_time.lte.19:00:00)');
    expect(h.or).not.toMatch(/date\.lte\.2026-10-31(,|$)/); // the old filter that swept in today's upcoming rows
    const m = rd('src/app/my-reservations.tsx');
    expect(m).toMatch(/history\.length > 0 \|\| !historyDone/);
    expect(m).not.toMatch(/date\.lte\./);
  });
  test('RI-13/14: the cap check is serialised per resident/court/day and approval cannot move the booking', () => {
    expect(rd('supabase/migrations/20261031100000_hoa_timezones.sql')).toMatch(/pg_advisory_xact_lock\(hashtextextended\('booking-cap:'/);
    expect(rd('supabase/migrations/20261031110000_exclusive_pending_reservations.sql')).toMatch(/An approval cannot change the reserved time/);
  });
  test('RI-15: the schedule sheet initialises its date only after the HOA zone has loaded', () => {
    expect(rd('src/components/admin/AmenityScheduleSheet.tsx')).toMatch(/visible && tzLoaded\) setDate\(communityToday\(new Date\(\), tz\)\)/);
    expect(rd('src/hooks/useHoaTimeZone.ts')).toMatch(/must not inherit the previous community/);
  });
});
