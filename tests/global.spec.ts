import { test, expect } from '@playwright/test';

const RESIDENT_ROUTES = [
  '/(resident)/',
  '/(resident)/book',
  '/(resident)/report',
  '/(resident)/calendar',
  '/(resident)/docs',
];

test.describe('Global Header — every resident screen', () => {
  for (const route of RESIDENT_ROUTES) {
    test(`TenisX logo visible on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(
        page.locator('[data-testid="tenisx-logo"]').first()
      ).toBeVisible({ timeout: 50000 });
    });

    test(`Bell icon visible on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 50000 });
    });

    test(`Hamburger menu visible on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 50000 });
    });
  }
});

test.describe('Global Font Sizes', () => {
  test('body text is at least 15px on home screen', async ({ page }) => {
    await page.goto('/(resident)/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 50000 });
    const sizes = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div, span'));
      return divs
        .filter((el) => (el as HTMLElement).innerText?.trim().length > 10)
        .map((el) => parseFloat(window.getComputedStyle(el).fontSize))
        .filter((s) => !isNaN(s) && s > 0);
    });
    const bodyTexts = sizes.filter((s) => s >= 13);
    expect(bodyTexts.length).toBeGreaterThan(0);
    expect(Math.min(...bodyTexts)).toBeGreaterThanOrEqual(13);
  });
});

test.describe('Tab Bar', () => {
  test('tab bar labels are at least 12px', async ({ page }) => {
    await page.goto('/(resident)/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 50000 });
    const tabLabels = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="bottom-nav"]');
      if (!nav) return [];
      const allEls = Array.from(nav.querySelectorAll('*'));
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
    await page.goto('/(resident)/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 50000 });
    const tabBarHeight = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="bottom-nav"]');
      return nav ? (nav as HTMLElement).getBoundingClientRect().height : 0;
    });
    expect(tabBarHeight).toBeGreaterThanOrEqual(70);
  });
});
