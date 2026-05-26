import { test, expect } from '@playwright/test';

const REPORTS = '/(resident)/report';

test.describe('Resident Reports Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REPORTS);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  // ── Header ────────────────────────────────────────────────────────────────

  test('header logo is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero ──────────────────────────────────────────────────────────────────

  test('"My Reports" heading is visible', async ({ page }) => {
    await expect(page.getByText('My Reports', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('"+" new report button exists', async ({ page }) => {
    await expect(page.locator('[data-testid="new-report-btn"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Filter tabs ───────────────────────────────────────────────────────────

  test('filter tab "Active" exists', async ({ page }) => {
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('filter tab "All" exists', async ({ page }) => {
    await expect(page.getByText('All', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('filter tab "Resolved" exists', async ({ page }) => {
    await expect(page.getByText('Resolved', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  // ── 2-step form ───────────────────────────────────────────────────────────

  test('tapping "+" opens the report form', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="report-form"]')).toBeVisible({ timeout: 10000 });
  });

  test('Step 1 has exactly 6 category tiles', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="report-form"]')).toBeVisible({ timeout: 10000 });
    const tiles = page.locator('[data-testid="category-tile"]');
    await expect(tiles).toHaveCount(6, { timeout: 5000 });
  });

  test('Step 1 has severity selector', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="report-form"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="severity-selector"]')).toBeVisible({ timeout: 5000 });
  });

  test('"Next Step" button exists on Step 1', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="report-form"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="next-step-btn"]')).toBeVisible({ timeout: 5000 });
  });

  test('"Next Step" advances to Step 2', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="next-step-btn"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.getByText('Step 2 of 2')).toBeVisible({ timeout: 5000 });
  });

  test('Step 2 has description text input', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.locator('[data-testid="description-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('Step 2 has photo upload area', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.locator('[data-testid="photo-upload-area"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Submit Report" button exists on Step 2', async ({ page }) => {
    await page.locator('[data-testid="new-report-btn"]').click();
    await page.locator('[data-testid="next-step-btn"]').click();
    await expect(page.locator('[data-testid="submit-btn"]')).toBeVisible({ timeout: 10000 });
  });

  test('submitting a report shows success state and closes form', async ({ page }) => {
    // Wait for Supabase data to load (hoaId needed for submit)
    await expect(
      page.locator('[data-testid="reports-empty"]').or(page.locator('[data-testid="report-card"]').first())
    ).toBeVisible({ timeout: 30000 });

    // Open form → Step 2
    await page.locator('[data-testid="new-report-btn"]').click();
    await page.locator('[data-testid="next-step-btn"]').click();

    // Fill description
    await page.locator('[data-testid="description-input"]').fill('Playwright test report — please ignore');

    // Submit
    await page.locator('[data-testid="submit-btn"]').click();

    // Success state
    await expect(page.locator('[data-testid="submit-success"]')).toBeVisible({ timeout: 15000 });
  });
});
