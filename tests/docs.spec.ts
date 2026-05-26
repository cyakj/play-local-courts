import { test, expect } from '@playwright/test';

test.describe('Docs Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? '';
        return body.includes('No documents') || /[1-9]\d* documents?/.test(body);
      },
      { timeout: 20000 },
    ).catch(() => {/* data may still be loading */});
  });

  test('TenisX logo is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Community Documents" heading is visible', async ({ page }) => {
    await expect(page.getByText('Community Documents')).toBeVisible({ timeout: 10000 });
  });

  test('document count in header is not "0 documents"', async ({ page }) => {
    const countEl = page.locator('div, span').filter({ hasText: /^[1-9]\d* documents?$/ }).first();
    await expect(countEl).toBeVisible({ timeout: 20000 });
  });

  test('"No documents" message is NOT visible when HOA has docs', async ({ page }) => {
    await expect(page.getByText('No documents')).not.toBeVisible({ timeout: 10000 });
  });

  test('at least one category section renders', async ({ page }) => {
    const docTitles = page.getByText(/Meeting #1|Rules4/);
    await expect(docTitles.first()).toBeVisible({ timeout: 20000 });
  });

  test('category sections have collapse chevron', async ({ page }) => {
    const chevrons = page.locator('svg').filter({
      has: page.locator('polyline, path').first(),
    });
    await expect(chevrons.first()).toBeVisible({ timeout: 10000 });
  });

  test('search bar exists', async ({ page }) => {
    await expect(
      page.locator('input[placeholder*="Search"], input[placeholder*="search"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test('search filters documents in real time', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
    await searchInput.fill('zzznomatch_____');
    await page.waitForTimeout(800);
    await expect(page.getByText(/no documents/i)).toBeVisible({ timeout: 8000 });
  });

  test('each document card has a view (eye) button', async ({ page }) => {
    const eyeIcons = page.locator('[data-testid="doc-eye-btn"]');
    await expect(eyeIcons.first()).toBeVisible({ timeout: 10000 });
  });

  test('each document card has a download button', async ({ page }) => {
    const downloadIcons = page.locator('[data-testid="doc-download-btn"]');
    await expect(downloadIcons.first()).toBeVisible({ timeout: 10000 });
  });
});
