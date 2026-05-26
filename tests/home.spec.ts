import { test, expect } from '@playwright/test';

test.describe('Resident Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? '';
        return body.includes('Community Announcements') || body.includes('Upcoming Reservations');
      },
      { timeout: 25000 },
    ).catch(() => {});
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
    const greeting = page.getByText(/Good (morning|afternoon|evening)/i);
    await expect(greeting).toBeVisible({ timeout: 10000 });
  });

  test('HOA community name is visible in hero', async ({ page }) => {
    const hoaName = page.getByText(/San Ignacio|The Greens|community/i);
    await expect(hoaName.first()).toBeVisible({ timeout: 15000 });
  });

  test('Community Announcements section header is visible', async ({ page }) => {
    await expect(page.getByText('Community Announcements')).toBeVisible({ timeout: 15000 });
  });

  test('at least one announcement is shown (not empty)', async ({ page }) => {
    const announcement = page.getByText(/Tennis Courts being Refurbished/i);
    await expect(announcement).toBeVisible({ timeout: 20000 });
  });

  test('Upcoming Reservations section header is visible', async ({ page }) => {
    await expect(page.getByText('Upcoming Reservations')).toBeVisible({ timeout: 15000 });
  });

  test('Upcoming Reservations shows content or empty state (not broken)', async ({ page }) => {
    const reservationsCard = page.locator('div, span').filter({
      hasText: /Upcoming Reservations/,
    }).first();
    await expect(reservationsCard).toBeVisible({ timeout: 15000 });
    const hasContent = await page.getByText(/No upcoming reservations|Book an Amenity/).isVisible({ timeout: 5000 }).catch(() => false);
    const hasBookings = await page.locator('[style*="cyanDot"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasContent || hasBookings).toBe(true);
  });

  test('bottom tab bar is visible', async ({ page }) => {
    await expect(page.getByText('HOME')).toBeVisible({ timeout: 10000 });
  });

  test('all 5 bottom tabs are visible with correct labels', async ({ page }) => {
    const labels = ['HOME', 'BOOK', 'REPORTS', 'CALENDAR', 'DOCS'];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
  });
});
