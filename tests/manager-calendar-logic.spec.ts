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
