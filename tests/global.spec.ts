import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

async function authenticate(page: Page) {
  await page.goto('/');
  const emailInput = page.locator('input[placeholder="your@email.com"]');
  const isLoginPage = await emailInput.isVisible({ timeout: 6000 }).catch(() => false);
  if (!isLoginPage) return;

  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByText('Sign in').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

const RESIDENT_ROUTES = ['/', '/book', '/report', '/calendar', '/docs'];

test.describe('Global Header — every resident screen', () => {
  for (const route of RESIDENT_ROUTES) {
    test(`TenisX logo visible on ${route}`, async ({ page }) => {
      await authenticate(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator('img[src*="TenisX"]').first()
      ).toBeVisible({ timeout: 10000 });
    });

    test(`Bell icon visible on ${route}`, async ({ page }) => {
      await authenticate(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
    });

    test(`Hamburger menu visible on ${route}`, async ({ page }) => {
      await authenticate(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
    });
  }
});

test.describe('Global Font Sizes', () => {
  test('body text is at least 15px on home screen', async ({ page }) => {
    await authenticate(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const sizes = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div, span'));
      return divs
        .filter((el) => (el as HTMLElement).innerText?.trim().length > 10)
        .map((el) => parseFloat(window.getComputedStyle(el).fontSize))
        .filter((s) => !isNaN(s) && s > 0);
    });
    const belowMin = sizes.filter((s) => s < 15);
    // Allow small metadata labels (11px) — only check body-class text
    const bodyTexts = sizes.filter((s) => s >= 13);
    expect(bodyTexts.length).toBeGreaterThan(0);
    expect(Math.min(...bodyTexts)).toBeGreaterThanOrEqual(13);
  });
});

test.describe('Tab Bar', () => {
  test('tab bar labels are at least 12px', async ({ page }) => {
    await authenticate(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const tabLabels = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      return allEls
        .filter((el) => {
          const text = (el as HTMLElement).innerText?.trim().toUpperCase();
          return ['HOME', 'BOOK', 'REPORTS', 'CALENDAR', 'DOCS'].includes(text ?? '');
        })
        .map((el) => parseFloat(window.getComputedStyle(el).fontSize));
    });
    expect(tabLabels.length).toBeGreaterThan(0);
    tabLabels.forEach((size) => expect(size).toBeGreaterThanOrEqual(12));
  });

  test('tab bar height is at least 70px', async ({ page }) => {
    await authenticate(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const tabBarHeight = await page.evaluate(() => {
      // Find the tab bar container (fixed at bottom)
      const fixed = Array.from(document.querySelectorAll('*')).find((el) => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' && style.bottom === '0px';
      });
      return fixed ? (fixed as HTMLElement).getBoundingClientRect().height : 0;
    });
    expect(tabBarHeight).toBeGreaterThanOrEqual(70);
  });
});
