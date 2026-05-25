import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[placeholder="your@email.com"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 25000 });
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Docs Screen', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await page.goto('/docs');
    await page.waitForLoadState('domcontentloaded');
    // Wait for Supabase data to load: count shows non-zero OR empty state appears
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? '';
        // Either empty state loaded or at least 1 doc loaded
        return body.includes('No documents') || /[1-9]\d* documents?/.test(body);
      },
      { timeout: 20000 },
    ).catch(() => {/* data may still be loading */});
  });

  test('TenisX logo is visible in header', async ({ page }) => {
    await expect(page.locator('img[src*="TenisX"]').first()).toBeVisible({ timeout: 10000 });
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
    // Wait for a non-zero count: e.g. "2 documents"
    const countEl = page.locator('div, span').filter({ hasText: /^[1-9]\d* documents?$/ }).first();
    await expect(countEl).toBeVisible({ timeout: 20000 });
  });

  test('"No documents" message is NOT visible when HOA has docs', async ({ page }) => {
    await expect(page.getByText('No documents')).not.toBeVisible({ timeout: 10000 });
  });

  test('at least one category section renders', async ({ page }) => {
    // Docs "Meeting #1" and "Rules4" belong to categories; they appear in expanded sections
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
