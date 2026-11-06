// Node-only: resident Schedule audit fixes (event status, pending reservations, closures, community wall-clock, board-only events).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CALENDAR_BOOKING_STATUSES, maintenanceToItems, reservationTitle, toWallClockIso } from '../src/lib/scheduleEvents';

const read = (p: string) => readFileSync(p, 'utf8');

test.describe('event query matches the table', () => {
  test('hoa_events.status is active|cancelled; the resident screens no longer filter on the impossible "approved"', () => {
    const initial = read('supabase/migrations/20260307225408_08b271ca-dcba-4a2a-9f81-ef098ff75e28.sql');
    expect(initial).toMatch(/status TEXT NOT NULL DEFAULT 'active' CHECK \(status IN \('active','cancelled'\)\)/);
    for (const f of ['src/app/(resident)/calendar.tsx', 'src/app/(resident)/index.tsx']) {
      const src = read(f);
      const block = src.slice(src.indexOf(".from('hoa_events')"));
      expect(block.slice(0, 500)).toContain(".eq('status', 'active')");
      expect(block.slice(0, 500)).not.toContain("'approved')\n");
    }
  });
});

test.describe('own reservations on the calendar', () => {
  test('confirmed and pending are listed; cancelled / expired / denied are not', () => {
    expect([...CALENDAR_BOOKING_STATUSES]).toEqual(['confirmed', 'pending']);
  });
  test('pending is labelled in words, not only by colour', () => {
    const f = (t: string) => t;
    expect(reservationTitle('Pool', '10:00', '11:00', 'pending', f)).toContain('Pending approval');
    expect(reservationTitle('Pool', '10:00', '11:00', 'confirmed', f)).not.toContain('Pending');
  });
  test('only the resident\'s own bookings are queried', () => {
    const src = read('src/app/(resident)/calendar.tsx');
    expect(src).toContain(".eq('user_id', uid)");
  });
});

test.describe('community wall-clock time', () => {
  test('a timestamptz is shown at the community clock, not the device clock', () => {
    // 2026-07-04T02:30Z is 22:30 on July 3 in New York (EDT) and 19:30 in Los Angeles (PDT)
    expect(toWallClockIso('2026-07-04T02:30:00Z', 'America/New_York')).toBe('2026-07-03T22:30:00');
    expect(toWallClockIso('2026-07-04T02:30:00Z', 'America/Los_Angeles')).toBe('2026-07-03T19:30:00');
    expect(toWallClockIso('2026-07-04T02:30:00Z', 'America/Puerto_Rico')).toBe('2026-07-03T22:30:00');
  });
  test('daylight saving is honoured (winter offset differs from summer)', () => {
    expect(toWallClockIso('2026-01-15T15:00:00Z', 'America/New_York')).toBe('2026-01-15T10:00:00');
    expect(toWallClockIso('2026-07-15T15:00:00Z', 'America/New_York')).toBe('2026-07-15T11:00:00');
  });
  test('an invalid zone or date never throws', () => {
    expect(toWallClockIso('2026-01-15T15:00:00Z', 'Not/AZone')).toMatch(/^2026-01-15T\d\d:00:00$/);
    expect(toWallClockIso('garbage', 'America/New_York')).toBe('garbage');
  });
});

test.describe('planned closures as Maintenance (shared with the booking blockout)', () => {
  const names = new Map([['h1', 'The Greens']]);
  const row = (o: object) => ({ id: 'c1', date: '2026-11-10', end_date: null, start_time: '08:00:00', end_time: '12:00:00', description: 'Resurfacing', courts: { name: 'Pool', hoa_id: 'h1' }, ...o });
  test('single-day closure becomes one Maintenance item with hours and reason', () => {
    const [it, ...rest] = maintenanceToItems([row({})], names, '2026-11-01');
    expect(rest).toHaveLength(0);
    expect(it).toMatchObject({ event_type: 'maintenance_scheduled', title: 'Pool unavailable', starts_at: '2026-11-10T08:00:00', hoa_id: 'h1', community_name: 'The Greens' });
    expect(it.description).toContain('Resurfacing');
    expect(it.description).toContain('08:00–12:00');
  });
  test('a multi-day closure marks every day; days before today are dropped', () => {
    const items = maintenanceToItems([row({ end_date: '2026-11-13' })], names, '2026-11-12');
    expect(items.map((i) => i.starts_at.slice(0, 10))).toEqual(['2026-11-12', '2026-11-13']);
  });
  test('rows without a court are ignored; absurd ranges are capped', () => {
    expect(maintenanceToItems([row({ courts: null })], names, '2026-01-01')).toHaveLength(0);
    expect(maintenanceToItems([row({ end_date: '2030-01-01' })], names, '2026-01-01').length).toBeLessThanOrEqual(120);
  });
  test('a long ongoing closure still shows today (cap counts from today, not from its start)', () => {
    const items = maintenanceToItems([row({ date: '2026-09-01', end_date: '2026-12-31' })], names, '2026-11-06');
    expect(items[0].starts_at.slice(0, 10)).toBe('2026-11-06');
    expect(items.length).toBeGreaterThan(50);
  });
  test('community wall-clock conversion happens at render so a later zone still applies', () => {
    const c = read('src/app/(resident)/calendar.tsx');
    expect(c).toContain('rawStartsAt');
    expect(c).toMatch(/activeEventType, communityZone, sharedCommunity\?\.hoaId, zonesByHoa\]/);
    expect(c).toContain('loadHoaZones(comms.map((c) => c.hoaId))'); // every community has its own zone, not just the active one
    expect(c).toContain('zonesByHoa.get(e.hoa_id)');
  });
  test('maintenance REPORTS are never queried by the resident Schedule', () => {
    expect(read('src/app/(resident)/calendar.tsx')).not.toContain('maintenance_reports');
  });
});

test.describe('board-only events (migration 20261106110000, not applied)', () => {
  const m = read('supabase/migrations/20261106110000_hoa_event_audience.sql');
  test('default keeps every existing event visible; residents policy narrows to audience=residents', () => {
    expect(m).toMatch(/ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'residents'/);
    expect(m).toContain("AND audience = 'residents'");
    expect(m).toContain("CHECK (audience IN ('residents', 'board'))");
  });
  test('rollback restores the original policy and warns about board events', () => {
    const rb = read('supabase/rollbacks/20261106110000_rollback_hoa_event_audience.sql');
    expect(rb).toContain('CREATE POLICY "Residents view community events"');
    expect(rb).toMatch(/WARNING/);
  });
  test('the admin app sends audience only when Board only is on and does not notify residents about it', () => {
    const cm = read('src/app/(cm)/calendar.tsx');
    expect(cm).toContain("...(type === 'board_meeting' && boardOnly ? { audience: 'board' } : {})");
    expect(cm).toContain("if (notify && !(type === 'board_meeting' && boardOnly))");
  });
  test('the resident screens never select the new column (they work before and after the migration)', () => {
    expect(read('src/app/(resident)/calendar.tsx')).not.toContain('audience');
  });
});
