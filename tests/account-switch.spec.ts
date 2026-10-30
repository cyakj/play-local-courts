import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Sign out -> sign in as a DIFFERENT account must not leak the previous account's identity or device state.
 * Read-only against hosted (auth sessions only; writes are blocked). Uses a fresh browser context.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByText('Sign in', { exact: true }).last().click();
}

async function accountName(page: Page): Promise<string> {
  await page.locator('[data-testid="avatar-icon"], [aria-label="Account menu"]').first().click();
  const name = page.locator('[data-testid="account-menu-name"]');
  await expect(name).toBeVisible({ timeout: 20000 });
  return (await name.innerText()).trim();
}

test('signing out clears device state and the next account sees only its own identity', async ({ page }) => {
  test.setTimeout(600000);
  const resident = { email: process.env.TEST_EMAIL!, password: process.env.TEST_PASSWORD! };
  const admin = { email: process.env.TEST_ADMIN_EMAIL!, password: process.env.TEST_ADMIN_PASSWORD! };
  test.skip(!resident.email || !admin.email, 'needs TEST_EMAIL and TEST_ADMIN_EMAIL');
  await blockHostedWrites(page);

  // --- account 1: resident
  await signIn(page, resident.email, resident.password);
  await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible({ timeout: 90000 });
  const residentName = await accountName(page);
  expect(residentName.length).toBeGreaterThan(0);
  const userKeysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tenisx_active_hoa:')));

  // --- sign out from the avatar menu
  await page.locator('[data-testid="menu-sign-out"]').click();
  await expect(page).toHaveURL(/login/, { timeout: 120000 });
  const userKeysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tenisx_active_hoa:')));
  expect(userKeysAfter).toEqual([]); // per-user device state is wiped (it existed before: ${userKeysBefore.length})
  const sessionLeft = await page.evaluate(() => Object.keys(localStorage).filter((k) => /auth-token/.test(k)));
  expect(sessionLeft).toEqual([]);

  // a protected screen is not reachable from history/URL after sign out
  await page.goto('/community');
  await expect(page).toHaveURL(/login/, { timeout: 120000 });

  // --- account 2: the admin; no trace of the resident's name
  await signIn(page, admin.email, admin.password);
  await expect(page.getByText(residentName, { exact: true })).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator('[data-testid="bell-icon"], [aria-label="Account menu"]').first()).toBeVisible({ timeout: 90000 });
  const adminName = await accountName(page);
  expect(adminName).not.toBe(residentName);
  await expect(page.locator('[data-testid="account-menu"]')).not.toContainText(residentName);
});
