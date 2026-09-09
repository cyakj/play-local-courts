import { test, expect } from '@playwright/test';

const DOCS = '/(resident)/docs';

test.describe('Resident Docs Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('domcontentloaded');
    // Community mode's Header renders testID="community-wordmark", not
    // "tenisx-logo" (Header.tsx: isCommunityMode branch) — waiting on the
    // wrong one hung every test in this file for the full 60s timeout.
    // docs-heading is docs.tsx's own always-rendered testID, independent of
    // header variant, so anchor on that instead.
    await expect(page.locator('[data-testid="docs-heading"]')).toBeVisible({ timeout: 15000 });
  });

  // ── Header ────────────────────────────────────────────────────────────────

  test('header wordmark is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="community-wordmark"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('avatar icon is visible', async ({ page }) => {
    // Header.tsx no longer has a "menu-icon" testID at all (in either mode) —
    // avatar-icon replaced the hamburger menu as the rightmost header action
    // (same finding already documented in courts.spec.ts).
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero ──────────────────────────────────────────────────────────────────

  test('"Community Documents" heading is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="docs-heading"]')).toBeVisible({ timeout: 10000 });
  });

  test('document count is shown in hero', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-count"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Supabase data ─────────────────────────────────────────────────────────

  test('document count is not "0 documents"', async ({ page }) => {
    // Wait for data to load — either doc cards or empty state
    await expect(
      page.locator('[data-testid="doc-card"]').first()
        .or(page.locator('[data-testid="docs-empty"]'))
    ).toBeVisible({ timeout: 30000 });
    // The count should show a non-zero number
    const countEl = page.locator('[data-testid="doc-count"]');
    await expect(countEl).not.toHaveText('0 documents', { timeout: 5000 });
  });

  test('"No documents" state is NOT visible when HOA has docs', async ({ page }) => {
    // Wait for data
    await expect(
      page.locator('[data-testid="doc-card"]').first()
        .or(page.locator('[data-testid="docs-empty"]'))
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="docs-empty"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('at least one document card renders from Supabase', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
  });

  // ── Categories ────────────────────────────────────────────────────────────

  test('documents are grouped in at least one category section', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="category-section"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('category section has a header label', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="category-label"]').first()).toBeVisible({ timeout: 5000 });
  });

  // ── Search ────────────────────────────────────────────────────────────────

  test('search bar is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('search filters documents in real time', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="search-input"]').fill('zzznomatch_____xyz');
    await expect(page.locator('[data-testid="docs-empty"]')).toBeVisible({ timeout: 8000 });
  });

  test('clearing search restores documents', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="search-input"]').fill('zzznomatch_____xyz');
    await expect(page.locator('[data-testid="docs-empty"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="search-input"]').clear();
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 8000 });
  });

  // ── Document buttons ──────────────────────────────────────────────────────

  test('each document card has a view (eye) button', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doc-eye-btn"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('each document card has a download button', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doc-download-btn"]').first()).toBeVisible({ timeout: 5000 });
  });
});
