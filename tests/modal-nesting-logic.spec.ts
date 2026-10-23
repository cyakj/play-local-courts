/**
 * Static guard for the iOS stacked-Modal defect (HOA Manager "Open Schedule" / "Add Blockout" did nothing).
 * On iOS a Modal rendered as a SIBLING of an open Modal cannot present; it must be a descendant of it.
 * Source-text test, Node only:  npx playwright test -c playwright.logic.config.ts modal-nesting-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/app/(admin)/manage-amenities.tsx', 'utf8');

test('AmenityScheduleSheet is rendered inside the amenity detail Modal, not beside it', () => {
  const open = src.indexOf('{/* Detail / Settings Modal */}');
  const modalStart = src.indexOf('<Modal', open);
  const modalEnd = src.indexOf('</Modal>', modalStart);
  const sheet = src.indexOf('<AmenityScheduleSheet');
  expect(open).toBeGreaterThan(-1);
  expect(sheet).toBeGreaterThan(modalStart);
  expect(sheet).toBeLessThan(modalEnd);
  expect(src.match(/<AmenityScheduleSheet/g)).toHaveLength(1);
});

test('closing the detail modal also closes the schedule sheet', () => {
  const fn = src.slice(src.indexOf('function closeDetail()'), src.indexOf('async function saveDetail'));
  expect(fn).toContain('setBlockoutVisible(false)');
  expect(fn).toContain('setDetailCourt(null)');
});
