import { test, expect } from '@playwright/test';
import { isCommunityMode, isTennisMode } from './helpers/productMode';

// Legend / filter wording per mode (src/app/(resident)/calendar.tsx):
//   community: Amenity Reservation · Community Event · Board Meeting · Maintenance
//   tennis:    Court Reservation · Match · Lesson · Club Event · Board Meeting · Maintenance
const RESERVATION = isCommunityMode ? 'Amenity Reservation' : 'Court Reservation';
const CLUB_EVENT = isCommunityMode ? 'Community Event' : 'Club Event';

const CALENDAR = '/(resident)/calendar';

test.describe('Resident Calendar Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CALENDAR);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  // ── Header ────────────────────────────────────────────────────────────────

  test('header logo is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('profile avatar icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero ──────────────────────────────────────────────────────────────────

  test('"Schedule" heading is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="schedule-heading"]')).toHaveText('Schedule', { timeout: 10000 });
  });

  test('current month label is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="month-label"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Calendar grid ─────────────────────────────────────────────────────────

  test('calendar grid renders with day headers', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible({ timeout: 10000 });
  });

  test('calendar grid shows Mon–Sun day labels', async ({ page }) => {
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible({ timeout: 10000 });
    }
  });

  // ── Supabase connection ───────────────────────────────────────────────────

  test('data loads — day events section appears', async ({ page }) => {
    await expect(page.locator('[data-testid="day-events-section"]')).toBeVisible({ timeout: 30000 });
  });

  test('calendar loads without error (no-events message or event cards)', async ({ page }) => {
    await expect(
      page.locator('[data-testid="no-events-msg"]')
        .or(page.locator('[data-testid="event-card"]').first())
    ).toBeVisible({ timeout: 30000 });
  });

  // ── Legend ────────────────────────────────────────────────────────────────

  test('legend shows the reservation type for the active mode', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: RESERVATION })).toBeVisible({ timeout: 10000 });
  });

  test('legend shows the club / community event type for the active mode', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: CLUB_EVENT })).toBeVisible({ timeout: 10000 });
  });

  test('legend shows Board Meeting', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: 'Board Meeting' })).toBeVisible({ timeout: 10000 });
  });

  test('legend shows Maintenance', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: 'Maintenance' })).toBeVisible({ timeout: 10000 });
  });

  // ── Filter tabs ───────────────────────────────────────────────────────────

  test('filter tab "All" exists', async ({ page }) => {
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: /^All$/ })).toBeVisible({ timeout: 10000 });
  });

  test('reservation filter tab exists for the active mode', async ({ page }) => {
    const label = isCommunityMode ? 'Amenity Reservations' : 'Court Reservations';
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: label })).toBeVisible({ timeout: 10000 });
  });

  test('club / community event filter tab exists for the active mode', async ({ page }) => {
    const label = isCommunityMode ? 'Community Events' : 'Club Events';
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: label })).toBeVisible({ timeout: 10000 });
  });

  test('Matches / Lessons filter tabs are tennis-only', async ({ page }) => {
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'All' }).first()).toBeVisible({ timeout: 10000 });
    const expected = isTennisMode ? 1 : 0;
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'Matches' })).toHaveCount(expected);
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'Lessons' })).toHaveCount(expected);
  });

  test('filter tab "Board Meeting" exists', async ({ page }) => {
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'Board Meeting' })).toBeVisible({ timeout: 10000 });
  });

  // ── Community chips ───────────────────────────────────────────────────────

  test('community chip "All" exists', async ({ page }) => {
    await expect(page.locator('[data-testid="community-chip"]').filter({ hasText: /^All$/ })).toBeVisible({ timeout: 10000 });
  });

  test('community chips load from Supabase', async ({ page }) => {
    // Wait for data to resolve — at least the "All" chip must be present
    await expect(page.locator('[data-testid="community-chip"]').first()).toBeVisible({ timeout: 25000 });
  });

  // ── Week/Month toggle ─────────────────────────────────────────────────────

  test('Week/Month toggle exists', async ({ page }) => {
    await expect(page.locator('[data-testid="view-toggle"]')).toBeVisible({ timeout: 10000 });
  });

  test('tapping "Week" switches to week view', async ({ page }) => {
    await page.locator('[data-testid="view-toggle-week"]').click();
    await expect(page.locator('[data-testid="week-grid"]')).toBeVisible({ timeout: 5000 });
  });

  test('tapping "Month" switches back to month view', async ({ page }) => {
    await page.locator('[data-testid="view-toggle-week"]').click();
    await expect(page.locator('[data-testid="week-grid"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="view-toggle-month"]').click();
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible({ timeout: 5000 });
  });

  // ── Date tap ──────────────────────────────────────────────────────────────

  test('tapping a date updates the events section header', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible({ timeout: 15000 });
    // click the first in-month day cell
    await page.locator('[data-testid="day-cell"]').first().click();
    await expect(page.locator('[data-testid="day-events-section"]')).toBeVisible({ timeout: 5000 });
  });

  // ── Hero polish ───────────────────────────────────────────────────────────

  test('"SCHEDULE" redundant label is NOT present in the page body', async ({ page }) => {
    // The Community bottom-nav tab is legitimately labelled SCHEDULE; only the hero/body
    // must not repeat it as an all-caps eyebrow above the "Schedule" title.
    await expect(page.locator('[data-testid="schedule-heading"]')).toBeVisible({ timeout: 10000 });
    const total = await page.getByText('SCHEDULE', { exact: true }).count();
    const inNav = await page.locator('[data-testid="bottom-nav"]').getByText('SCHEDULE', { exact: true }).count();
    expect(total - inNav).toBe(0);
  });

  test('hero subtitle (month label) is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="month-label"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Legend polish ─────────────────────────────────────────────────────────

  test('all legend items for the active mode are visible', async ({ page }) => {
    const items = page.locator('[data-testid="legend-item"]');
    const labels = isCommunityMode
      ? [RESERVATION, CLUB_EVENT, 'Board Meeting', 'Maintenance']
      : [RESERVATION, 'Match', 'Lesson', CLUB_EVENT, 'Board Meeting', 'Maintenance'];
    await expect(items).toHaveCount(labels.length, { timeout: 10000 });
    for (const label of labels) {
      await expect(items.filter({ hasText: label })).toBeVisible({ timeout: 5000 });
    }
  });

  // ── Day events section ────────────────────────────────────────────────────

  test('day events section shows either events or empty state', async ({ page }) => {
    await expect(page.locator('[data-testid="day-events-section"]')).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator('[data-testid="no-events-msg"]')
        .or(page.locator('[data-testid="event-card"]').first())
    ).toBeVisible({ timeout: 30000 });
  });

  // ── Screenshots ───────────────────────────────────────────────────────────

  test('screenshot: calendar month view', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="day-events-section"]')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'test-results/calendar-month-snapshot.png' });
  });

  test('screenshot: calendar week view', async ({ page }) => {
    await page.locator('[data-testid="view-toggle-week"]').click();
    await expect(page.locator('[data-testid="week-grid"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/calendar-week-snapshot.png' });
  });
});
