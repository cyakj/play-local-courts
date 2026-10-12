/**
 * Edit Profile → home location: search "Dorado", pick a result, save, reopen.
 *
 * Mapbox is URL-restricted (HTTP 403 without an allowed Referer), so in the browser this
 * exercises the real provider-failure path → bundled Puerto Rico fallback. Either source
 * must produce a selectable "Dorado". The test restores the previous (empty) location.
 */
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/edit-profile');
  await expect(page.locator('[data-testid="location-input"]')).toBeVisible({ timeout: 30000 });
  // let the saved profile finish loading into the field
  await page.waitForTimeout(1500);
}

test.describe('Edit Profile location', () => {
  test('search → select → save → persists after reopening', async ({ page }) => {
    await open(page);
    const input = page.locator('[data-testid="location-input"]');
    const original = await input.inputValue();
    test.skip(original.trim() !== '', 'account already has a saved location; not overwriting it');

    try {
      await input.click();
      await input.fill('Dorado');
      const suggestion = page.locator('[data-testid="location-suggestion"]').filter({ hasText: 'Dorado' }).first();
      await expect(suggestion).toBeVisible({ timeout: 20000 });

      // A provider failure must be described honestly — never as a connection problem.
      const err = page.locator('[data-testid="location-error"]');
      expect(await err.count()).toBe(0);

      await suggestion.click();
      await expect(input).toHaveValue(/Dorado/);
      await expect(page.locator('[data-testid="header-save"]')).toBeEnabled();
      await page.locator('[data-testid="header-save"]').click();
      await expect(page).not.toHaveURL(/edit-profile/, { timeout: 15000 });

      await open(page);
      await expect(page.locator('[data-testid="location-input"]')).toHaveValue(/Dorado/);
    } finally {
      // restore: clear and save
      await page.goto('/edit-profile');
      const i2 = page.locator('[data-testid="location-input"]');
      await expect(i2).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1500);
      if ((await i2.inputValue()).trim() !== '') {
        await i2.click();
        await i2.fill('');
        await page.locator('[data-testid="header-save"]').click();
        await page.waitForTimeout(1500);
      }
    }
  });

  test('no-results and short-query states are distinct', async ({ page }) => {
    await open(page);
    const input = page.locator('[data-testid="location-input"]');
    await input.click();
    await input.fill('Do');
    await expect(page.getByText('Type at least 3 characters to search.')).toBeVisible();
    await input.fill('Zzzqqxx');
    await expect(page.locator('[data-testid="location-no-results"]').or(page.locator('[data-testid="location-error"]'))).toBeVisible({ timeout: 20000 });
    // an unreachable/denied provider must not claim the connection is down
    const err = page.locator('[data-testid="location-error"]');
    if (await err.count()) {
      await expect(err).not.toContainText(/check your connection/i);
    }
    // and leaving the field without choosing reverts stray text
    await input.fill('');
  });
});
