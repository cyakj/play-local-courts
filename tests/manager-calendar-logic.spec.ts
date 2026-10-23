/**
 * Static guard: the HOA/Condo Manager calendar must not pull routine resident reservations.
 * Reservations are inspected per amenity (Manage Amenities -> Schedule). Node only.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/(cm)/calendar.tsx', 'utf8');

test('manager calendar never queries the bookings table', () => {
  expect(src).not.toMatch(/from\(['"]bookings['"]\)/);
});

test('manager calendar offers no Reservation type filter and builds no reservation events', () => {
  const all = src.match(/const ALL_TYPES: EventType\[\] = \[([^\]]*)\]/);
  expect(all).not.toBeNull();
  expect(all![1]).not.toContain('reservation');
  expect(all![1]).toContain('blockout');
  expect(src).not.toMatch(/type: 'reservation'/);
});

test('reservation shortcuts open amenity management, not the calendar', () => {
  const community = readFileSync('src/app/(cm)/community/[hoaId].tsx', 'utf8');
  const portfolio = readFileSync('src/app/(cm)/index.tsx', 'utf8');
  expect(community).not.toContain("router.push('/(cm)/calendar')");
  expect(community).toContain('onPress={openAmenitySchedule}');
  const todayCard = portfolio.split('\n').find((l) => l.includes("Today's bookings")) ?? '';
  expect(todayCard).toContain('/(admin)/manage-amenities');
  expect(todayCard).not.toContain('/(cm)/calendar');
});

test('community recent-activity lists only reservations awaiting approval', () => {
  const community = readFileSync('src/app/(cm)/community/[hoaId].tsx', 'utf8');
  // Anchored to the recent-bookings query (limit 6), not the join-request query that also filters on pending.
  expect(community).toMatch(/from\('bookings'\)\.select\('id, user_id, court_id, date, start_time, status, created_at'\)[^;]*?\.eq\('status', 'pending'\)[^;]*?\.limit\(6\)/s);
});
