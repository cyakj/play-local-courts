/**
 * Settings → unsaved-changes dialog (Save Changes / Discard Changes / Keep Editing).
 *
 * Runs on web, where the guard renders its equivalent modal; native uses Alert.alert with
 * the same three options. The header Save button is enabled exactly when the form differs
 * from what is persisted, so it doubles as the dirty indicator (RN-web's Switch does not
 * expose a reliable checked state).
 *
 * The two Save tests write the signed-in account's notification preferences and then
 * restore them.
 */
import { test, expect, type Page } from '@playwright/test';

const SCREEN = '/settings-notifications';
const save = (page: Page) => page.locator('[data-testid="header-save"]');
const back = (page: Page) => page.locator('[data-testid="header-back"]');
const dialog = (page: Page) => page.locator('[data-testid="unsaved-dialog"]');
const firstSwitch = (page: Page) => page.getByRole('switch').first();

async function open(page: Page) {
  await page.goto(SCREEN);
  await expect(page.getByText('ALERT PREFERENCES')).toBeVisible({ timeout: 30000 });
  await expect(save(page)).toBeVisible();
  // wait for the saved preferences to load (switches are disabled while loading)
  await expect(firstSwitch(page)).toBeEnabled({ timeout: 20000 });
}

const isPrefsPatch = (r: any) =>
  r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' &&
  (r.request().postData() ?? '').includes('notification_preferences');

test.describe('Settings unsaved changes', () => {
  test('clean form: Save is disabled and leaving does not prompt', async ({ page }) => {
    await open(page);
    await expect(save(page)).toBeDisabled();
    await back(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/settings-notifications/);
  });

  test('toggle then toggle back = not changed = no prompt', async ({ page }) => {
    await open(page);
    await firstSwitch(page).click();
    await expect(save(page)).toBeEnabled();
    await firstSwitch(page).click();
    await expect(save(page)).toBeDisabled();
    await back(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/settings-notifications/);
  });

  test('a real change prompts with exactly Save / Discard / Keep Editing', async ({ page }) => {
    await open(page);
    await firstSwitch(page).click();
    await back(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('[data-testid="unsaved-save"]')).toHaveText('Save Changes');
    await expect(page.locator('[data-testid="unsaved-discard"]')).toHaveText('Discard Changes');
    await expect(page.locator('[data-testid="unsaved-keep"]')).toHaveText('Keep Editing');
  });

  test('Keep Editing closes the dialog, stays on the screen and keeps the edit', async ({ page }) => {
    await open(page);
    await firstSwitch(page).click();
    await back(page).click();
    await page.locator('[data-testid="unsaved-keep"]').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/settings-notifications/);
    await expect(save(page)).toBeEnabled(); // still dirty — the edit was not lost
  });

  test('Discard Changes leaves without writing anything', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/rest/v1/profiles')) writes.push(r.url()); });
    await open(page);
    await firstSwitch(page).click();
    await back(page).click();
    await page.locator('[data-testid="unsaved-discard"]').click();
    await expect(page).not.toHaveURL(/settings-notifications/);
    expect(writes).toHaveLength(0);
    await open(page);
    await expect(save(page)).toBeDisabled(); // reopened screen matches persisted state
  });

  test('Save Changes persists (PATCH ok), leaves, and does not prompt again', async ({ page }) => {
    await open(page);
    try {
      await firstSwitch(page).click();
      await back(page).click();
      const patch = page.waitForResponse(isPrefsPatch);
      await page.locator('[data-testid="unsaved-save"]').click();
      expect((await patch).ok()).toBe(true);
      await expect(page).not.toHaveURL(/settings-notifications/, { timeout: 15000 });
      await expect(dialog(page)).toHaveCount(0);
    } finally {
      await open(page);
      await firstSwitch(page).click(); // restore the original preference
      const patch = page.waitForResponse(isPrefsPatch);
      await save(page).click();
      await patch;
    }
  });

  test('header Save button saves and leaves without prompting again', async ({ page }) => {
    await open(page);
    try {
      await firstSwitch(page).click();
      const patch = page.waitForResponse(isPrefsPatch);
      await save(page).click();
      expect((await patch).ok()).toBe(true);
      await expect(page).not.toHaveURL(/settings-notifications/, { timeout: 15000 });
      await expect(dialog(page)).toHaveCount(0);
    } finally {
      await open(page);
      await firstSwitch(page).click();
      const patch = page.waitForResponse(isPrefsPatch);
      await save(page).click();
      await patch;
    }
  });
});
