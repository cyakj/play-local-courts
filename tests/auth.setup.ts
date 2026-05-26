import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const AUTH_FILE = '.playwright/storageState.json';

setup('authenticate once', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[placeholder="your@email.com"]');
  await emailInput.waitFor({ state: 'visible', timeout: 60000 });

  await emailInput.fill(process.env.TEST_EMAIL ?? '');
  await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD ?? '');
  await page.getByText('Sign in', { exact: true }).click();

  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');

  await page.context().storageState({ path: AUTH_FILE });
});
