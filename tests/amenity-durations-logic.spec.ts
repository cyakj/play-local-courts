// Node-only: HOA-configured allowed durations (resident options, Singles/Doubles buttons, admin validation, migration shape).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  durationLabel, durationOptions, formatDurationSubtext, isRacquetType, pickDuration, sanitizeDurationList, serverDurationCap,
  validateDurationList,
} from '../src/lib/bookingDurations';

const read = (p: string) => readFileSync(p, 'utf8');

test.describe('who gets Singles/Doubles', () => {
  test('tennis and pickleball only', () => {
    expect(isRacquetType('tennis')).toBe(true);
    expect(isRacquetType('Pickleball')).toBe(true);
    for (const t of ['pool', 'clubhouse', 'gym', 'barbecue', 'jacuzzi', 'meeting_room', '', null, undefined]) expect(isRacquetType(t)).toBe(false);
  });
  test('the resident sheet renders the format buttons only for racquet amenities', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toMatch(/\{!showCalendar && isRacquet && \(\s*<View style=\{styles\.playTypeRow\}>/);
    expect(c).toContain('isRacquetType(bookingSheet?.courtType)');
  });
});

test.describe('racquet amenities: per-format durations', () => {
  const r = { singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 90 };
  test('legacy (no lists): Singles 60, Doubles 90 for tennis; not hard-coded', () => {
    expect(durationOptions('tennis', 'singles', r)).toEqual([60]);
    expect(durationOptions('tennis', 'doubles', r)).toEqual([90]);
    expect(durationOptions('tennis', 'singles', { singles_duration_minutes: 45, doubles_duration_minutes: 120 })).toEqual([45]);
    expect(durationOptions('tennis', 'doubles', { singles_duration_minutes: 45, doubles_duration_minutes: 120 })).toEqual([120]);
  });
  test('legacy pickleball follows the server cap (max_duration_minutes), not the format length', () => {
    expect(serverDurationCap('pickleball', 'doubles', { doubles_duration_minutes: 90, max_duration_minutes: 60 })).toBe(60);
    expect(durationOptions('pickleball', 'doubles', { doubles_duration_minutes: 90, max_duration_minutes: 60 })).toEqual([60]);
  });
  test('explicit independent lists per format', () => {
    const x = { ...r, singles_allowed_durations: [60], doubles_allowed_durations: [60, 90] };
    expect(durationOptions('tennis', 'singles', x)).toEqual([60]);
    expect(durationOptions('tennis', 'doubles', x)).toEqual([60, 90]);
  });
  test('a list entry above the server cap is not offered (it would be rejected)', () => {
    const x = { singles_duration_minutes: 60, singles_allowed_durations: [30, 60, 90] };
    expect(durationOptions('tennis', 'singles', x)).toEqual([30, 60]);
  });
  test('invalid / empty lists fall back to legacy', () => {
    expect(durationOptions('tennis', 'singles', { singles_duration_minutes: 60, singles_allowed_durations: [] })).toEqual([60]);
    expect(durationOptions('tennis', 'singles', { singles_duration_minutes: 60, singles_allowed_durations: null })).toEqual([60]);
  });
});

test.describe('non-racquet amenities: pool / clubhouse examples from the product brief', () => {
  test('Pool A 60 only', () => expect(durationOptions('pool', 'singles', { max_duration_minutes: 60, allowed_durations: [60] })).toEqual([60]));
  test('Pool B 90 only: no 60 choice', () => expect(durationOptions('pool', 'singles', { max_duration_minutes: 90, allowed_durations: [90] })).toEqual([90]));
  test('Pool C 60 or 90', () => expect(durationOptions('pool', 'singles', { max_duration_minutes: 90, allowed_durations: [90, 60] })).toEqual([60, 90]));
  test('Clubhouse 120/180/240', () => expect(durationOptions('clubhouse', 'singles', { max_duration_minutes: 240, allowed_durations: [240, 120, 180] })).toEqual([120, 180, 240]));
  test('no list: legacy behaviour is unchanged (never a silent new default)', () => {
    expect(durationOptions('pool', 'singles', { max_duration_minutes: 60, singles_duration_minutes: 60, doubles_duration_minutes: 90 })).toEqual([60]);
    expect(durationOptions('pool', 'singles', null)).toEqual([60]);
  });
  test('a list never overrides the server cap', () => {
    expect(durationOptions('pool', 'singles', { max_duration_minutes: 60, allowed_durations: [60, 90] })).toEqual([60]);
  });
  test('allowed duration is independent of the daily booking quota', () => {
    expect(durationOptions('pool', 'singles', { max_duration_minutes: 90, allowed_durations: [90], max_reservations_per_day: 1 })).toEqual([90]);
  });
});

test.describe('labels and selection', () => {
  test('units always shown, never a bare decimal', () => {
    expect(durationLabel(90)).toBe('90 min');
    expect(formatDurationSubtext([60])).toBe('60 min');
    expect(formatDurationSubtext([60, 90])).toBe('60 · 90 min');
    expect(formatDurationSubtext([])).toBe('');
    expect(`${durationLabel(150)}`).not.toMatch(/\d\.\d/);
  });
  test('pickDuration keeps a still-allowed choice, otherwise the shortest option', () => {
    expect(pickDuration([60, 90], 90)).toBe(90);
    expect(pickDuration([60, 90], 120)).toBe(60);
    expect(pickDuration([90], null)).toBe(90);
  });
  test('sanitize drops junk and sorts', () => {
    expect(sanitizeDurationList([90, 60, 60, -5, 1.5, 'x', null])).toEqual([60, 90]);
    expect(sanitizeDurationList(null)).toEqual([]);
  });
  test('the sheet shows duration inside each format button and no floating label', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toContain('play-type-duration-${type}');
    expect(c).not.toMatch(/durationInlineText\}>\{duration\} min/);
  });
});

test.describe('admin validation', () => {
  test('rejects empty, off-grid and out-of-range lists', () => {
    expect(validateDurationList([], 'Pool')).toMatch(/at least one/);
    expect(validateDurationList([20], 'Pool')).toMatch(/15-minute/);
    expect(validateDurationList([10], 'Pool')).toMatch(/15/);
    expect(validateDurationList([495], 'Pool')).toMatch(/15/);
    expect(validateDurationList([60, 90], 'Pool')).toBeNull();
  });
});

test.describe('migration 20261106100000 (shape; not applied anywhere)', () => {
  const m = read('supabase/migrations/20261106100000_amenity_allowed_durations.sql');
  test('additive columns, null default, no back-fill', () => {
    expect(m).toMatch(/ADD COLUMN IF NOT EXISTS allowed_durations integer\[\]/);
    expect(m).toMatch(/singles_allowed_durations integer\[\]/);
    expect(m).toMatch(/doubles_allowed_durations integer\[\]/);
    expect(m).not.toMatch(/\bUPDATE\b\s+public\.amenity_rules/i);
    expect(m).not.toMatch(/DEFAULT\s+ARRAY/i);
  });
  test('enforced server-side on insert, for tennis and pickleball by play type, in addition to the cap', () => {
    expect(m).toContain("ctype IN ('tennis', 'pickleball')");
    expect(m).toMatch(/BEFORE INSERT ON public\.bookings/);
    expect(m).toContain('IF allowed IS NULL THEN RETURN NEW; END IF;');
    expect(m).not.toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_amenity_booking_rules/);
  });
  test('trigger function not callable by API roles; rollback restores', () => {
    expect(m).toMatch(/REVOKE ALL ON FUNCTION public\.enforce_allowed_durations\(\) FROM PUBLIC, anon, authenticated/);
    const rb = read('supabase/rollbacks/20261106100000_rollback_amenity_allowed_durations.sql');
    expect(rb).toMatch(/DROP TRIGGER IF EXISTS enforce_allowed_durations_trg/);
    expect(rb).toMatch(/DROP COLUMN IF EXISTS allowed_durations/);
  });
});

test.describe('resident fetch tolerates a server without the new columns', () => {
  test('retries without the list columns when the select errors', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toContain('SHEET_DURATION_LIST_COLUMNS');
    expect(c).toMatch(/if \(res\.error\) res = await supabase\.from\('amenity_rules'\)\.select\(SHEET_RULE_COLUMNS\)/);
  });
});

import { draftFromRules, draftToColumns, validateDraft } from '../src/lib/bookingDurations';

test.describe('admin editor model', () => {
  test('initial draft shows what residents get today (no silent replacement)', () => {
    expect(draftFromRules('pool', { max_duration_minutes: 60 })).toEqual({ general: [60], singles: [], doubles: [] });
    expect(draftFromRules('tennis', { singles_duration_minutes: 60, doubles_duration_minutes: 90 })).toEqual({ general: [], singles: [60], doubles: [90] });
    expect(draftFromRules('clubhouse', { max_duration_minutes: 240, allowed_durations: [120, 240] }).general).toEqual([120, 240]);
  });
  test('saved columns keep the legacy cap in step with the longest listed length', () => {
    expect(draftToColumns('pool', { general: [90, 60], singles: [], doubles: [] })).toEqual({ allowed_durations: [60, 90], max_duration_minutes: 90 });
    expect(draftToColumns('pickleball', { general: [], singles: [60], doubles: [60, 90] })).toEqual({
      singles_allowed_durations: [60], doubles_allowed_durations: [60, 90],
      singles_duration_minutes: 60, doubles_duration_minutes: 90, max_duration_minutes: 90,
    });
  });
  test('an empty selection cannot be saved', () => {
    expect(validateDraft('pool', { general: [], singles: [], doubles: [] })).toMatch(/at least one/);
    expect(validateDraft('tennis', { general: [], singles: [60], doubles: [] })).toMatch(/Doubles/);
  });
  test('saved config round-trips to exactly what the resident sees', () => {
    const cols = draftToColumns('tennis', { general: [], singles: [60], doubles: [60, 90] });
    expect(durationOptions('tennis', 'singles', cols as never)).toEqual([60]);
    expect(durationOptions('tennis', 'doubles', cols as never)).toEqual([60, 90]);
  });
  test('admin screen degrades to the legacy cap when the server lacks the list columns', () => {
    const a = read('src/app/(admin)/manage-amenities.tsx');
    expect(a).toContain("!('allowed_durations' in rules)");
    expect(a).toContain('legacyOnly');
  });
});
