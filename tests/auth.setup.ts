import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const AUTH_FILE = '.playwright/storageState.json';

setup('authenticate once', async ({ page }) => {
  // If storageState already has a valid (non-expired) token, skip UI login
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      const origin = state.origins?.[0];
      const tokenEntry = origin?.localStorage?.find((e: { name: string }) => e.name.includes('-auth-token'));
      if (tokenEntry) {
        const tokenData = JSON.parse(tokenEntry.value);
        const expiresAt = tokenData.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt > nowSec + 60) {
          // Token still valid for at least 60 more seconds — skip UI login
          console.log('Valid auth token found in storageState, skipping UI login.');
          return;
        }
      }
    } catch {
      // fall through to UI login
    }
  }

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
