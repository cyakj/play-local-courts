import { test, expect } from '@playwright/test';

/**
 * QA spec for the resident "Me" dashboard screen.
 */

const ME = '/(resident)/me';

test.describe('Me screen — dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ME);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  test('screen loads without red error', async ({ page }) => {
    await expect(page.locator('text=/^Error$/')).not.toBeVisible({ timeout: 10000 });
  });

  test('header shows logo, messages, bell, and avatar icons', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="messages-icon"]')).toBeVisible();
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible();
  });

  test('Messages section is NOT duplicated in the page body', async ({ page }) => {
    await page.waitForTimeout(1500);
    await expect(page.getByText('Messages', { exact: true })).toHaveCount(0);
  });

  test('Notifications section is NOT duplicated in the page body', async ({ page }) => {
    await page.waitForTimeout(1500);
    await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);
  });

  test('NTRP stat is visible', async ({ page }) => {
    await expect(page.getByText('NTRP', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('COMMUNITY stat is visible', async ({ page }) => {
    await expect(page.getByText('COMMUNITY', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('HOME stat is visible', async ({ page }) => {
    await expect(page.getByText('HOME', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('Edit Profile button is visible and navigates', async ({ page }) => {
    const btn = page.getByText('Edit Profile');
    await expect(btn).toBeVisible({ timeout: 20000 });
    await btn.click();
    await expect(page).toHaveURL(/edit-profile/, { timeout: 15000 });
  });

  test('UPCOMING section is visible', async ({ page }) => {
    await expect(page.getByText('UPCOMING')).toBeVisible({ timeout: 20000 });
  });

  test('lesson preview or empty state is visible', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(
      page.getByText(/upcoming lessons — find a coach/i)
        .or(page.locator('text=/Private|Semi-Private|Group Clinic|Practice/'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('reservation preview or empty state is visible', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(
      page.getByText(/no court bookings — reserve a court/i)
        .or(page.locator('text=/–/').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('match preview or empty state is visible', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(
      page.getByText(/no upcoming matches — find an opponent/i)
        .or(page.getByText(/^vs /))
    ).toBeVisible({ timeout: 15000 });
  });

  test('ACCOUNT section shows Settings and Help & Support', async ({ page }) => {
    await expect(page.getByText('ACCOUNT')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('Help & Support')).toBeVisible();
  });

  test('Settings row navigates to /settings', async ({ page }) => {
    await page.getByText('Settings', { exact: true }).click();
    await expect(page).toHaveURL(/settings$/, { timeout: 15000 });
  });

  test('Help & Support row navigates to /settings-help', async ({ page }) => {
    await page.getByText('Help & Support').click();
    await expect(page).toHaveURL(/settings-help/, { timeout: 15000 });
  });

  test('Sign Out button is visible', async ({ page }) => {
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 20000 });
  });

  test('NTRP info tooltip opens and closes', async ({ page }) => {
    await page.waitForTimeout(1000);
    const label = page.getByText('NTRP', { exact: true });
    await expect(label).toBeVisible({ timeout: 20000 });
    const infoBtn = page.locator('[aria-label="NTRP info"]').first();
    await infoBtn.click();
    await expect(page.getByText(/self-assessed USTA skill level/i)).toBeVisible({ timeout: 10000 });
    // dismiss via backdrop tap
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(10, 10);
    await expect(page.getByText(/self-assessed USTA skill level/i)).not.toBeVisible({ timeout: 10000 });
  });
});
