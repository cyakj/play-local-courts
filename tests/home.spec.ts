import { test, expect } from '@playwright/test';

const HOME = '/(resident)/';

test.describe('Resident Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    await page.waitForLoadState('domcontentloaded');
    // Wait until the resident header is rendered
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  test('TenisX logo is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu icon is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('greeting text is visible (Good morning/afternoon/evening)', async ({ page }) => {
    const greeting = page.getByText(/Good (morning|afternoon|evening),/i);
    await expect(greeting.first()).toBeVisible({ timeout: 15000 });
  });

  test('HOA community name is visible in hero', async ({ page }) => {
    // hoaName fetched from Supabase and rendered below greeting
    await expect(page.locator('[data-testid="hoa-name"]')).toBeVisible({ timeout: 30000 });
  });

  test('Community Announcements section header is visible', async ({ page }) => {
    await expect(page.getByText('Community Announcements')).toBeVisible({ timeout: 20000 });
  });

  test('at least one announcement is shown (not empty)', async ({ page }) => {
    // Wait for either a real row (data loaded) or the empty state (no data)
    await expect(
      page.locator('[data-testid="announcement-row"]').first()
        .or(page.getByText('No announcements yet'))
    ).toBeVisible({ timeout: 20000 });
    // The test HOA has announcement data — assert a row is present
    await expect(page.locator('[data-testid="announcement-row"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Upcoming Reservations section header is visible', async ({ page }) => {
    await expect(page.getByText('Upcoming Reservations', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('Upcoming Reservations shows content or empty state (not broken)', async ({ page }) => {
    // Wait for loading to finish — either real rows or the empty-state appear
    await expect(page.getByText('No upcoming reservations').or(
      page.locator('[data-testid="booking-row"]').first()
    )).toBeVisible({ timeout: 20000 });
  });

  test('bottom tab bar is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 10000 });
  });

  test('all 5 bottom tabs are visible with correct labels', async ({ page }) => {
    const labels = ['HOME', 'BOOK', 'REPORTS', 'CALENDAR', 'DOCS'];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
  });
});
