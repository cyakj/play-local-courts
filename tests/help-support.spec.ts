/**
 * Help & Support: every row leads to real content or an explicit "not published" state;
 * no empty header box; licenses are generated from the real dependency tree.
 * Read-only (no data written).
 */
import { test, expect } from '@playwright/test';

test.describe('Help & Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings-help');
    await expect(page.getByText('Help & Support', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  });

  test('all five rows are present', async ({ page }) => {
    for (const id of ['help-faq', 'help-contact', 'help-terms', 'help-privacy', 'help-licenses']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
  });

  test('header has a back button and no empty filled box', async ({ page }) => {
    await expect(page.locator('[data-testid="header-back"]')).toBeVisible();
    // The old header drew a 36x36 translucent square on the right as a "spacer".
    const squares = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div')).filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.backgroundColor === 'rgba(255, 255, 255, 0.12)' && el.children.length === 0 && r.width > 20 && r.width < 60 && r.top < 140;
      }).length);
    expect(squares).toBe(0);
  });

  test('FAQ opens a usable FAQ with expandable answers', async ({ page }) => {
    await page.locator('[data-testid="help-faq"]').click();
    const q = page.locator('[data-testid="faq-question"]');
    await expect(q.first()).toBeVisible({ timeout: 15000 });
    expect(await q.count()).toBeGreaterThanOrEqual(6);
    await q.first().click();
    await expect(page.locator('[data-testid="faq-answer"]')).toBeVisible();
    await expect(page.locator('[data-testid="faq-contact-support"]')).toBeVisible();
  });

  test('Terms of Service shows an honest unpublished state (no dead web link) with a support path', async ({ page }) => {
    await page.locator('[data-testid="help-terms"]').click();
    await expect(page.locator('[data-testid="legal-unpublished"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Terms of Service isn’t published yet')).toBeVisible();
    await expect(page.locator('[data-testid="legal-contact-support"]')).toBeVisible();
  });

  test('Privacy Policy shows the same explicit state', async ({ page }) => {
    await page.locator('[data-testid="help-privacy"]').click();
    await expect(page.locator('[data-testid="legal-unpublished"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Privacy Policy isn’t published yet')).toBeVisible();
  });

  test('Open Source Licenses lists the real dependency tree and shows license text', async ({ page }) => {
    await page.locator('[data-testid="help-licenses"]').click();
    await expect(page.locator('[data-testid="license-row"]').first()).toBeVisible({ timeout: 20000 });
    await page.locator('[data-testid="license-search"]').fill('react-native-reanimated');
    const row = page.locator('[data-testid="license-row"]').first();
    await expect(row).toContainText('react-native-reanimated');
    await row.click();
    await expect(page.locator('[data-testid="license-name"]')).toHaveText('react-native-reanimated');
    await expect(page.locator('[data-testid="license-text"]')).toContainText(/Permission is hereby granted|MIT|license/i);
  });

  test('search with no match shows an empty message', async ({ page }) => {
    await page.locator('[data-testid="help-licenses"]').click();
    await page.locator('[data-testid="license-search"]').fill('zzzz-no-such-package-zzzz');
    await expect(page.getByText('No matching packages.')).toBeVisible();
  });
});
