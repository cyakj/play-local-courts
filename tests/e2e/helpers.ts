import { existsSync } from 'node:fs';
import type { Browser, BrowserContext, Page } from '@playwright/test';

export const STATE = {
  resident: '.playwright/storageState.json',
  reviewer: '.playwright/reviewer.json',
};

export const hasState = (file: string) => existsSync(file);

export const BASE = 'http://localhost:8082';

/** Unique, greppable marker for rows created by a run (removed after the run). */
export const runTag = () => `e2e-${Date.now().toString(36)}`;

/** Sign in through the real login screen with the TEST_ADMIN_* account from .env (never logged). */
export async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.locator('input[placeholder="your@email.com"]').fill(process.env.TEST_ADMIN_EMAIL ?? '');
  await page.locator('input[type="password"]').first().fill(process.env.TEST_ADMIN_PASSWORD ?? '');
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 90000 });
}

export async function contextFor(browser: Browser, stateFile: string): Promise<BrowserContext> {
  return browser.newContext({ storageState: stateFile, viewport: { width: 390, height: 844 } });
}

/**
 * Fresh access token + user id for a saved session. The app refreshes the token when it loads, so open
 * it once and read the refreshed session back from localStorage. Returned only to the test process.
 */
export async function sessionOf(browser: Browser, stateFile: string): Promise<{ token: string; userId: string }> {
  const ctx = await contextFor(browser, stateFile);
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(8000);
  const raw = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)!;
      if (/auth-token$/.test(k)) return localStorage.getItem(k);
    }
    return null;
  });
  await ctx.close();
  if (!raw) throw new Error(`No signed-in session in ${stateFile}`);
  const s = JSON.parse(raw);
  return { token: s.access_token as string, userId: s.user.id as string };
}

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const apiHeaders = (token: string, extra: Record<string, string> = {}) => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...extra,
});
