/**
 * Report Detail presentation rules + regression for the unreadable dark canvas.
 * Node only:  npx playwright test -c playwright.logic.config.ts report-detail
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  categoryLabel, reportTitle, reportWhere, severityPill, showUpdated, statusPill,
} from '../src/lib/reportDetailView';

test.describe('status and severity pills', () => {
  test('known statuses map to a label and readable colours; unknown ones are humanised', () => {
    expect(statusPill('open').label).toBe('Open');
    expect(statusPill('in_progress').label).toBe('In progress');
    expect(statusPill('resolved').label).toBe('Resolved');
    expect(statusPill('waiting_on_vendor').label).toBe('Waiting on vendor');
    expect(statusPill('').label).toBe('Unknown');
  });
  test('severity pills exist for the four levels and are absent for unknown/empty', () => {
    expect(severityPill('low')?.label).toBe('Low severity');
    expect(severityPill('MEDIUM')?.label).toBe('Medium severity');
    expect(severityPill('high')?.label).toBe('High severity');
    expect(severityPill('critical')?.label).toBe('Critical severity');
    expect(severityPill(null)).toBeNull();
    expect(severityPill('whatever')).toBeNull();
  });
  test('every pill has its own light tint with a dark foreground (readable on either theme)', () => {
    const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    for (const p of [statusPill('open'), statusPill('in_progress'), statusPill('resolved'), statusPill('closed'), severityPill('low')!, severityPill('medium')!, severityPill('high')!, severityPill('critical')!]) {
      expect(ratio(p.bg, p.fg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('title, location and dates', () => {
  const base = { report_type: 'maintenance', location_text: null, amenity_name: null, category: 'plumbing' };
  test('title prefers the amenity, then a location, then the category', () => {
    expect(reportTitle({ ...base, amenity_name: 'The Greens Court' })).toBe('The Greens Court');
    expect(reportTitle({ ...base, report_type: 'location', location_text: 'Main gate' })).toBe('Main gate');
    expect(reportTitle(base)).toBe(categoryLabel('plumbing'));
    expect(categoryLabel('grounds_landscaping')).toBe('Grounds & Landscaping');
    expect(categoryLabel('something_new')).toBe('Something new');
  });
  test('where: amenity name, else trimmed free text, else nothing', () => {
    expect(reportWhere({ amenity_name: 'Pool', location_text: 'x' })).toBe('Pool');
    expect(reportWhere({ amenity_name: null, location_text: '  Gate  ' })).toBe('Gate');
    expect(reportWhere({ amenity_name: null, location_text: '   ' })).toBeNull();
  });
  test('Last updated only appears when it differs from the submission time', () => {
    expect(showUpdated('2026-10-30T10:00:00Z', '2026-10-30T10:00:20Z')).toBe(false);
    expect(showUpdated('2026-10-30T10:00:00Z', '2026-10-31T09:00:00Z')).toBe(true);
  });
});

test('REGRESSION: the screen is built on theme tokens, not the legacy dark static canvas', () => {
  const s = readFileSync('src/app/report-detail/[id].tsx', 'utf8');
  expect(s).not.toMatch(/Colors\.pageBg/);
  expect(s).not.toMatch(/Colors\.white/);
  expect(s).toMatch(/backgroundColor: theme\.pageBg/);
  expect(s).toMatch(/backgroundColor: theme\.cardBg/);
});
