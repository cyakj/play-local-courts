/**
 * Final verification follow-ups (2026-10-30): schedule scope and notification save results.
 * Node only:  npx playwright test -c playwright.logic.config.ts final-verification-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hasNothingToFetch } from '../src/lib/scheduleScope';
import { updateSucceeded } from '../src/lib/notificationPrefs';

const src = (p: string) => readFileSync(`src/${p}`, 'utf8');

test.describe('Schedule scope (calendar defect)', () => {
  test('Community mode with no community has nothing to load', () => {
    expect(hasNothingToFetch(0, false)).toBe(true);
  });
  test('Tennis mode still loads personal matches and lessons with zero communities', () => {
    expect(hasNothingToFetch(0, true)).toBe(false);
  });
  test('any community means there is something to load in both modes', () => {
    expect(hasNothingToFetch(1, false)).toBe(false);
    expect(hasNothingToFetch(2, true)).toBe(false);
  });
  test('the screen uses the helper and never queries hoa_events with an empty community list', () => {
    const s = src('app/(resident)/calendar.tsx');
    expect(s).toMatch(/hasNothingToFetch\(comms\.length, isTennisMode\)/);
    expect(s).toMatch(/hoaIds\.length === 0 \? \{ data: null \}/);
  });
});

test.describe('Notification save result', () => {
  test('an RPC error is a failure', () => {
    expect(updateSucceeded({ data: null, error: { message: 'x' } })).toBe(false);
  });
  test('false (no row updated) is a failure even without an error', () => {
    expect(updateSucceeded({ data: false, error: null })).toBe(false);
  });
  test('a missing result is a failure (the RPC contract is a boolean)', () => {
    expect(updateSucceeded({ data: null, error: null })).toBe(false);
    expect(updateSucceeded({ data: undefined, error: null })).toBe(false);
  });
  test('true is a success', () => {
    expect(updateSucceeded({ data: true, error: null })).toBe(true);
  });
  test('the API layer treats a failed update as a failed save', () => {
    expect(src('lib/notificationPrefsApi.ts')).toMatch(/if \(!updateSucceeded\(res\)\) failed\.push\(change\)/);
  });
});

import { MAX_REPORT_PHOTO_BYTES, base64DecodedBytes, reportPhotoProblem } from '../src/lib/reportPhotoLimits';

test.describe('Report photo limits (match the report-photos bucket: 5 MB, jpeg/png/webp)', () => {
  test('exactly 5 MB is allowed, one byte more is refused', () => {
    expect(reportPhotoProblem(MAX_REPORT_PHOTO_BYTES, 'image/jpeg')).toBeNull();
    expect(reportPhotoProblem(MAX_REPORT_PHOTO_BYTES + 1, 'image/jpeg')).toMatch(/5 MB/);
  });
  test('unsupported types are refused; an unknown (empty) type defers to the byte sniff', () => {
    expect(reportPhotoProblem(10, 'image/gif')).toMatch(/JPG, PNG or WebP/);
    expect(reportPhotoProblem(10, 'application/pdf')).toMatch(/JPG, PNG or WebP/);
    expect(reportPhotoProblem(10, 'IMAGE/PNG')).toBeNull();
    expect(reportPhotoProblem(10, '')).toBeNull();
  });
  test('base64 decoded size is exact, with padding', () => {
    expect(base64DecodedBytes(Buffer.from('abc').toString('base64'))).toBe(3);
    expect(base64DecodedBytes(Buffer.from('abcd').toString('base64'))).toBe(4);
    expect(base64DecodedBytes(Buffer.from('abcde').toString('base64'))).toBe(5);
  });
  test('the screen validates before upload and advertises the same limit', () => {
    const s = src('app/report.tsx');
    expect(s).toMatch(/reportPhotoProblem\(file\.size, file\.type\)/);
    expect(s).toMatch(/max 5 MB/);
    expect(s).not.toMatch(/max 10 MB/);
  });
});

test('report submit re-checks the photo size before the report row is created (camera and gallery too)', () => {
  const s = src('app/report.tsx');
  const submit = s.slice(s.indexOf('async function handleSubmit'));
  expect(submit.indexOf('reportPhotoProblem(')).toBeGreaterThan(-1);
  expect(submit.indexOf('reportPhotoProblem(')).toBeLessThan(submit.indexOf(".from('maintenance_reports').insert"));
  const camera = s.slice(s.indexOf('launchCameraAsync'), s.indexOf('launchImageLibraryAsync'));
  expect(camera).toMatch(/reportPhotoProblem\(base64DecodedBytes/);
});
