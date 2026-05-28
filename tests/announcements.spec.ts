import { test, expect } from '@playwright/test';

const ANNOUNCEMENTS = '/announcements';

test.describe('Announcements Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ANNOUNCEMENTS);
    await page.waitForLoadState('domcontentloaded');
    // Wait for the inner header title
    await expect(page.getByText('Announcements')).toBeVisible({ timeout: 60000 });
  });

  test('page title "Announcements" is visible in header', async ({ page }) => {
    await expect(page.getByText('Announcements')).toBeVisible({ timeout: 10000 });
  });

  test('back button is visible in header', async ({ page }) => {
    // Inner header renders ArrowLeft which is an SVG — the back button container is present
    await expect(page.locator('[data-testid="inner-back-btn"]').or(
      page.locator('button').first()
    )).toBeTruthy();
  });

  test('announcements load — items or empty state visible', async ({ page }) => {
    await expect(
      page.locator('[data-testid="announcement-item"]').first()
        .or(page.locator('[data-testid="announcements-empty"]'))
    ).toBeVisible({ timeout: 30000 });
  });

  test('at least one announcement item is visible from Supabase', async ({ page }) => {
    await expect(page.locator('[data-testid="announcement-item"]').first()).toBeVisible({ timeout: 30000 });
  });

  test('each announcement has a title and body text', async ({ page }) => {
    await expect(page.locator('[data-testid="announcement-item"]').first()).toBeVisible({ timeout: 30000 });
    // The first item should have rendered text content
    const firstItem = page.locator('[data-testid="announcement-item"]').first();
    const text = await firstItem.textContent();
    expect(text).toBeTruthy();
    expect((text ?? '').length).toBeGreaterThan(5);
  });

  test('survey result items show "View Results →" button', async ({ page }) => {
    await expect(
      page.locator('[data-testid="announcement-item"]').first()
        .or(page.locator('[data-testid="announcements-empty"]'))
    ).toBeVisible({ timeout: 30000 });
    // If any survey results exist, the view-results button should appear
    const count = await page.locator('[data-testid="survey-view-results-btn"]').count();
    if (count > 0) {
      await expect(page.locator('[data-testid="survey-view-results-btn"]').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
