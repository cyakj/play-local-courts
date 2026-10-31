/**
 * A day's availability is only presented once it has loaded. Node only:  npx playwright test -c playwright.logic.config.ts availability-gate
 */
import { test, expect } from '@playwright/test';
import { gateAvailability } from '../src/lib/availabilityGate';

const unknown = { statusText: 'UNKNOWN', detailText: 'Availability could not be loaded' };
const open = () => ({ statusText: 'OPEN NOW', detailText: 'Available all day' });

test.describe('gateAvailability', () => {
  test('REGRESSION: a day that has not loaded is NOT shown as open (no value at all, so the card says CHECKING)', () => {
    let computed = false;
    expect(gateAvailability(undefined, () => { computed = true; return open(); }, unknown)).toBeUndefined();
    expect(computed).toBe(false);
  });
  test('REGRESSION: a failed first load shows UNKNOWN, never "Available all day"', () => {
    const v = gateAvailability('error', open, unknown);
    expect(v).toEqual(unknown);
    expect(JSON.stringify(v)).not.toContain('Available all day');
  });
  test('a stale refresh keeps the data but says it may be out of date', () => {
    expect(gateAvailability('stale', open, unknown)).toEqual({ statusText: 'OPEN NOW', detailText: 'Available all day (may be out of date)' });
  });
  test('a loaded day is shown unchanged', () => {
    expect(gateAvailability('ok', open, unknown)).toEqual(open());
  });
});
