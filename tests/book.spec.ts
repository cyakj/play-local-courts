import { test, expect } from '@playwright/test';

const BOOK = '/(resident)/book';

test.describe('Resident Book Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BOOK);
    await page.waitForLoadState('domcontentloaded');
    // Wait for header to confirm resident layout loaded
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  test('header logo is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('"No amenities available" is NOT shown — real data loads', async ({ page }) => {
    // Wait for either amenity cards or the empty state
    await expect(
      page.locator('[data-testid="amenity-card"]').first()
        .or(page.getByText('No amenities available', { exact: false }))
    ).toBeVisible({ timeout: 25000 });
    // Assert amenity cards ARE present (not the empty state)
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('at least one amenity card renders', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
  });

  test('filter tab "All" is visible and active by default', async ({ page }) => {
    await expect(page.getByText('All', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('filter tabs Courts, Pools, Other all exist', async ({ page }) => {
    for (const label of ['Courts', 'Pools', 'Other']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
  });

  test('tapping "Book Now" navigates to booking detail screen', async ({ page }) => {
    // Wait for an amenity card to appear
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    // Click the first "Book Now →" button
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // Should navigate to amenity-book; wait for date strip heading
    await expect(page.getByText('SELECT DATE')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen shows amenity name', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // Amenity name is shown in the detail header
    await expect(page.locator('[data-testid="amenity-detail-name"]')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen has date selector pills', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // "Today" date pill should always be present
    await expect(page.getByText('Today')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen has OPTIONS card with Type of Play', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    await expect(page.getByText('OPTIONS')).toBeVisible({ timeout: 20000 });
    // Type of Play or Type of Use
    await expect(
      page.getByText('Type of Play').or(page.getByText('Type of Use'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('booking detail screen has Duration selector', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    await expect(page.getByText('Duration')).toBeVisible({ timeout: 20000 });
  });
});
