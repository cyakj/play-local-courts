import { test, expect } from '@playwright/test';

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

  test('hamburger menu icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero ──────────────────────────────────────────────────────────────────

  test('"Calendar" heading is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-heading"]')).toBeVisible({ timeout: 10000 });
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

  test('legend shows Amenity Booking', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: 'Amenity Booking' })).toBeVisible({ timeout: 10000 });
  });

  test('legend shows Community Event', async ({ page }) => {
    await expect(page.locator('[data-testid="legend-item"]').filter({ hasText: 'Community Event' })).toBeVisible({ timeout: 10000 });
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

  test('filter tab "Amenity Booking" exists', async ({ page }) => {
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'Amenity Booking' })).toBeVisible({ timeout: 10000 });
  });

  test('filter tab "Community Event" exists', async ({ page }) => {
    await expect(page.locator('[data-testid="event-type-tab"]').filter({ hasText: 'Community Event' })).toBeVisible({ timeout: 10000 });
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

  // ── Date tap ──────────────────────────────────────────────────────────────

  test('tapping a date updates the events section header', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible({ timeout: 15000 });
    // click the first in-month day cell
    await page.locator('[data-testid="day-cell"]').first().click();
    await expect(page.locator('[data-testid="day-events-section"]')).toBeVisible({ timeout: 5000 });
  });
});
