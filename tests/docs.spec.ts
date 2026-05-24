import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

async function authenticate(page: Page) {
  await page.goto('/');
  const emailInput = page.locator('input[type="email"]').first();
  const visible = await emailInput.isVisible({ timeout: 8000 }).catch(() => false);
  if (visible) {
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  }
}

test.describe('Docs Screen', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
    await page.goto('/docs');
    await page.waitForLoadState('networkidle');
  });

  test('TenisX logo is visible in header', async ({ page }) => {
    await expect(page.locator('img[src*="TenisX"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible in header', async ({ page }) => {
    // Bell SVG rendered by lucide-react-native on web
    const bell = page.locator('img[alt*="bell"], [aria-label*="bell"]').or(
      page.locator('svg').filter({ has: page.locator('path[d*="M18 8A6 6"]') })
    );
    await expect(bell.first()).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu is visible in header', async ({ page }) => {
    const menu = page.locator('img[alt*="menu"], [aria-label*="menu"]').or(
      page.locator('svg').filter({ has: page.locator('line') })
    );
    await expect(menu.first()).toBeVisible({ timeout: 10000 });
  });

  test('"Community Documents" heading is visible', async ({ page }) => {
    await expect(page.getByText('Community Documents')).toBeVisible({ timeout: 10000 });
  });

  test('document count in header is not "0 documents"', async ({ page }) => {
    const countEl = page.locator('div, span').filter({ hasText: /^\d+ documents?$/ }).first();
    await expect(countEl).toBeVisible({ timeout: 10000 });
    const text = await countEl.textContent();
    expect(text?.trim()).not.toBe('0 documents');
    expect(text?.trim()).not.toBe('0 document');
  });

  test('"No documents" message is NOT visible when HOA has docs', async ({ page }) => {
    // Give time for Supabase to load
    await page.waitForTimeout(3000);
    await expect(page.getByText('No documents')).not.toBeVisible();
  });

  test('at least one category section renders', async ({ page }) => {
    const categoryLabels = ['RULES', 'MEETING', 'FINANCIAL', 'MAINTENANCE', 'FORMS'];
    let found = false;
    for (const label of categoryLabels) {
      const el = page.getByText(new RegExp(label, 'i'));
      if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('category sections have collapse chevron', async ({ page }) => {
    // ChevronDown or ChevronRight SVG present
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
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
    await searchInput.fill('zzznomatch_____');
    await page.waitForTimeout(800);
    await expect(page.getByText(/no documents/i)).toBeVisible({ timeout: 5000 });
  });

  test('each document card has a view (eye) button', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Eye icon SVG from lucide
    const eyeIcons = page.locator('svg').filter({
      has: page.locator('path[d*="M1 12"]').or(page.locator('circle[cx="12"]')),
    });
    await expect(eyeIcons.first()).toBeVisible({ timeout: 10000 });
  });

  test('each document card has a download button', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Download icon SVG from lucide
    const downloadIcons = page.locator('svg').filter({
      has: page.locator('path[d*="M21 15"]').or(page.locator('polyline[points*="7 10"]')),
    });
    await expect(downloadIcons.first()).toBeVisible({ timeout: 10000 });
  });
});
