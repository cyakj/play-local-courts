import { test, expect } from '@playwright/test';

test.describe('Resident Navigation — Phase 1', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to resident group — '/' redirects to login
    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 60000 });
  });

  test('exactly 5 bottom tabs are visible', async ({ page }) => {
    const tabs = page.locator('[data-testid^="tab-"]');
    await expect(tabs).toHaveCount(5, { timeout: 10000 });
  });

  test('Home tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-index"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="bottom-nav"]').getByText('HOME')).toBeVisible({ timeout: 10000 });
  });

  test('Courts tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-courts"]')).toBeVisible({ timeout: 10000 });
  });

  test('Match tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-match"]')).toBeVisible({ timeout: 10000 });
  });

  test('Coaches tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-coaches"]')).toBeVisible({ timeout: 10000 });
  });

  test('Me tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-me"]')).toBeVisible({ timeout: 10000 });
  });

  test('Book tab is NOT in bottom nav', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-book"]')).toHaveCount(0);
  });

  test('Reports tab is NOT in bottom nav', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-report"]')).toHaveCount(0);
  });

  test('Calendar tab is NOT in bottom nav', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-calendar"]')).toHaveCount(0);
  });

  test('Docs tab is NOT in bottom nav', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-docs"]')).toHaveCount(0);
  });

  test('only one bottom nav exists on screen', async ({ page }) => {
    await expect(page.locator('[data-testid="bottom-nav"]')).toHaveCount(1);
  });

  test('Courts tab navigates correctly', async ({ page }) => {
    await page.locator('[data-testid="tab-courts"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="bottom-nav"]').getByText('COURTS')).toBeVisible();
  });

  test('Match tab navigates correctly', async ({ page }) => {
    await page.locator('[data-testid="tab-match"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="bottom-nav"]').getByText('MATCH')).toBeVisible();
  });

  test('Coaches tab navigates correctly', async ({ page }) => {
    await page.locator('[data-testid="tab-coaches"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="bottom-nav"]').getByText('COACHES')).toBeVisible();
  });

  test('Me tab navigates correctly', async ({ page }) => {
    await page.locator('[data-testid="tab-me"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="tab-me"]').getByText('ME', { exact: true })).toBeVisible();
  });

  test('bottom nav bar height meets 72px minimum', async ({ page }) => {
    const nav = page.locator('[data-testid="bottom-nav"]');
    const box = await nav.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(72);
  });

  test('tab touch zones are at least 44px wide', async ({ page }) => {
    const tabs = page.locator('[data-testid^="tab-"]');
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      if (box) expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});
