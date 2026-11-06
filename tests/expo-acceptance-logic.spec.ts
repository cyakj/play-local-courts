/**
 * Expo Go acceptance corrections (2026-11-05). Node only:  npx playwright test -c playwright.logic.config.ts expo-acceptance
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { allowedDurations, durationCap, resolveDuration } from '../src/lib/bookingDurations';
import { computeSlots, limitReason } from '../src/lib/slotAvailability';
import { ghostIndexes, ghostLayout, wheelPad, DRUM_OPACITY_STOPS } from '../src/lib/wheelLayout';
import { cancellationLine, detailSummary } from '../src/lib/reservationDetailCopy';

const read = (p: string) => readFileSync(p, 'utf8');

test.describe('durations reflect the HOA configuration (Greens Pool 90-minute "Limit" bug)', () => {
  test('root cause: 60/90 configured but max_duration_minutes 60 -> only 60 offered, 90 never offered', () => {
    expect(allowedDurations(false, { singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 60 })).toEqual([60]);
  });
  test('both allowed', () => expect(allowedDurations(false, { singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 90 })).toEqual([60, 90]));
  test('90 only', () => expect(allowedDurations(false, { singles_duration_minutes: 90, doubles_duration_minutes: 90, max_duration_minutes: 90 })).toEqual([90]));
  test('no configured lengths -> the cap is the only option; missing rules -> default 60', () => {
    expect(allowedDurations(false, { max_duration_minutes: 120 })).toEqual([120]);
    expect(allowedDurations(false, null)).toEqual([60]);
  });
  test('tennis is fixed by play type (no selector) and the cap follows play type', () => {
    expect(allowedDurations(true, { singles_duration_minutes: 60, doubles_duration_minutes: 90 })).toEqual([]);
    expect(durationCap(true, 'doubles', { singles_duration_minutes: 60, doubles_duration_minutes: 90 })).toBe(90);
    expect(durationCap(true, 'singles', { singles_duration_minutes: 60, doubles_duration_minutes: 90 })).toBe(60);
  });
  test('a stale override that is no longer allowed falls back to an allowed length', () => {
    const r = { singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 60 };
    expect(resolveDuration(allowedDurations(false, r), 90, r)).toBe(60);
    expect(resolveDuration([60, 90], 90, r)).toBe(90);
  });
  test('every offered duration yields a selectable time on an open day (never a wall of "Limit")', () => {
    const r = { singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 60 };
    for (const d of allowedDurations(false, r)) {
      const slots = computeSlots({ openMins: 420, closeMins: 1140, durationMins: d, isToday: false, nowMins: 0, reservations: [], blocks: [], limits: { maxPerDay: 1, maxDurationMins: durationCap(false, 'singles', r) } });
      expect(slots.some((s) => s.state === 'available')).toBe(true);
    }
  });
});

test.describe('reason labels are distinct', () => {
  const base = { openMins: 480, closeMins: 720, durationMins: 60, isToday: false, nowMins: 0, blocks: [] };
  test('duration above the cap yields no rows at all, not "limit" rows', () => {
    expect(computeSlots({ ...base, durationMins: 90, reservations: [], limits: { maxDurationMins: 60 } })).toEqual([]);
  });
  test('daily count reached -> limit only; pending bookings count; conflicts stay reserved', () => {
    const mine = [{ start_time: '08:00', end_time: '09:00', isMine: true, pending: true }];
    expect(limitReason({ ...base, reservations: mine, limits: { maxPerDay: 1 } })).toBe('daily');
    const r = computeSlots({ ...base, reservations: mine, limits: { maxPerDay: 1 } });
    expect(r.find((s) => s.start === '10:00')?.state).toBe('limit');
    expect(r.find((s) => s.start === '08:00')?.state).toBe('reserved');
  });
  test('90 minutes near closing: late starts are dropped, not limited', () => {
    expect(computeSlots({ ...base, durationMins: 90, reservations: [] }).at(-1)?.start).toBe('10:30');
  });
  test('the sheet words: date-level daily-limit explanation, pill says "Daily limit", never a bare "Limit"', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toContain('daily-limit-state');
    expect(c).toContain('dailyLimitOnly');
    const w = read('src/components/ui/TimeSlotWheel.tsx');
    expect(w).toContain("limit: 'Daily limit'");
    expect(w).not.toContain("limit: 'Limit'");
  });
  test('single allowed duration is an informational label, not a button', () => {
    expect(read('src/app/(resident)/courts.tsx')).toContain('availableDurations.length === 1');
  });
  test('server enforces the same cap (trigger uses max_duration_minutes for non-tennis)', () => {
    expect(read('supabase/migrations/20260922005928_greens_v1_fix_duration_cap_tennis_vs_amenity.sql')).toContain('max_duration_minutes');
  });
});

test.describe('wheel edges', () => {
  const ITEM = 44;
  test('ghost rows + remainder reproduce the original padding exactly (real rows do not move)', () => {
    for (const h of [132, 200, 308, 396, 463]) {
      const g = ghostLayout(h, ITEM);
      expect(g.count * ITEM + g.remainder).toBeCloseTo(wheelPad(h, ITEM), 6);
      expect(g.remainder).toBeGreaterThanOrEqual(0);
      expect(g.remainder).toBeLessThan(ITEM);
    }
  });
  test('ghost indexes never collide with a real slot, for 1, 2 and many slots', () => {
    for (const n of [1, 2, 30]) {
      const { top, bottom } = ghostIndexes(4, n);
      expect(top.every((i) => i < 0)).toBe(true);
      expect(bottom.every((i) => i >= n)).toBe(true);
      expect(top).toHaveLength(4);
      expect(bottom).toHaveLength(4);
    }
  });
  test('a tall wheel on the first/last slot is filled by rows and selectable rows stay readable', () => {
    expect(ghostLayout(463, ITEM).count).toBeGreaterThanOrEqual(4);
    expect(DRUM_OPACITY_STOPS.opacity[3]).toBeGreaterThanOrEqual(0.4);
  });
  test('ghost rows are inert: hidden from accessibility, no press handler, no time or weather', () => {
    const w = read('src/components/ui/TimeSlotWheel.tsx');
    const ghost = w.slice(w.indexOf('const GhostRow'), w.indexOf('A custom drum wheel'));
    expect(ghost).toContain('pointerEvents="none"');
    expect(ghost).toContain('no-hide-descendants');
    expect(ghost).not.toMatch(/onPress|TouchableOpacity|wxForSlot|fmtSlot/);
    expect(w).toMatch(/slot\.state !== 'available'\) return; \/\/ disabled rows never select/);
  });
  test('side contours are unchanged and derived from the same cylinder as the rows', () => {
    const w = read('src/components/ui/TimeSlotWheel.tsx');
    expect(w).toContain("contourPath(wheelW - 2, boxH - 2, cyl.bow, 'left')");
    expect(w.match(/cyl\.bow/g)!.length).toBeGreaterThanOrEqual(4);
  });
});

test.describe('legend: solid dots on the route that renders it', () => {
  const l = read('src/components/ui/ReservationLegend.tsx');
  test('the reservation route (courts.tsx) imports and renders this ReservationLegend twice (picker + schedule)', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toContain("import { ReservationLegend } from '@/components/ui/ReservationLegend'");
    expect((c.match(/<ReservationLegend /g) ?? []).length).toBe(2);
  });
  test('six picker dots in the requested colours; no icons or outlined squares', () => {
    expect(l).toMatch(/picker: \['available', 'selected', 'reserved', 'blocked', 'mine', 'pending'\]/);
    for (const [k, t] of [['available', 'available'], ['selected', 'selected'], ['reserved', 'reserved'], ['blocked', 'blocked'], ['mine', 'mine'], ['pending', 'minePending']]) {
      expect(l).toContain(`${k}: Availability.${t},`);
    }
    expect(l).not.toMatch(/lucide|swatch|borderWidth|Lock|Check\b/);
    expect(l).toMatch(/dot: \{ width: 10, height: 10, borderRadius: 5 \}/);
    expect(l).toContain('accessibilityLabel={label.full}');
  });
});

test.describe('reservation detail copy', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const common = { date: '2026-11-06', startTime: '09:00:00', now, timeZone: 'America/New_York' };
  test('pending: promises a hold only when the server enforces it', () => {
    expect(detailSummary('pending', true)).toBe('Awaiting HOA approval. Your time is held until reviewed or the reservation starts.');
    expect(detailSummary('pending', false)).toBe('Awaiting HOA approval. Your reservation is not confirmed yet.');
    expect(detailSummary('pending', false)).not.toMatch(/held/);
  });
  test('other states are one short sentence', () => {
    for (const k of ['confirmed', 'completed', 'request_expired', 'rejected', 'cancelled'] as const) expect(detailSummary(k, true).length).toBeLessThan(90);
  });
  test('cancellation available: deadline in the HOA zone from the HOA window (not hardcoded 24)', () => {
    expect(cancellationLine({ kind: 'pending', status: 'pending', minHours: 24, ...common })).toEqual({ kind: 'available', text: 'Cancel before Nov 5 at 9:00 AM.' });
    expect(cancellationLine({ kind: 'confirmed', status: 'confirmed', minHours: 48, ...common })).toEqual({ kind: 'available', text: 'Cancel before Nov 4 at 9:00 AM.' });
  });
  test('deadline passed: one closed line using the HOA window', () => {
    expect(cancellationLine({ kind: 'confirmed', status: 'confirmed', minHours: 72, ...common })).toEqual({ kind: 'closed', text: 'Cancellation closed · Less than 72 hours before start.' });
  });
  test('status-based reasons are not blamed on the deadline', () => {
    expect(cancellationLine({ kind: 'in_progress', status: 'confirmed', minHours: 24, ...common }).kind).toBe('status');
    for (const [kind, status] of [['completed', 'confirmed'], ['request_expired', 'pending'], ['cancelled', 'cancelled'], ['rejected', 'rejected']] as const) {
      expect(cancellationLine({ kind, status, minHours: 24, ...common })).toEqual({ kind: 'none' });
    }
  });
  test('the screen has no separate policy sentence and no second unavailable box', () => {
    const s = read('src/app/reservation-detail/[id].tsx');
    expect(s).not.toContain('Cancellation policy:');
    expect(s).not.toContain('Cancellation unavailable');
    expect(s).not.toContain('kindDescription');
    expect((s.match(/testID="cancellation-note"/g) ?? []).length).toBe(2); // one per mutually exclusive branch
  });
});

test.describe('Community Pulse regression (static)', () => {
  const home = read('src/app/(resident)/index.tsx');
  test('Home has no separate neon Maintenance Notice card and does not read court_maintenance', () => {
    expect(home).not.toMatch(/MAINTENANCE NOTICE|maintenance-notice|maintenanceBanner|upcomingMaintenance|court_maintenance/);
  });
  test('exactly one announcement is previewed, urgent first, and private reports are never shown', () => {
    expect(home).toContain('pickPulseAnnouncement(announcementsRes.rows)');
    expect(home).toContain('setAnnouncements(pulse ? [pulse] : [])');
    expect(home).not.toMatch(/maintenance_reports/);
  });
});
