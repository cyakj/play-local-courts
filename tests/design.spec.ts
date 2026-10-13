import { test, expect } from '@playwright/test';
import { isCommunityMode, isTennisMode } from './helpers/productMode';

const HOME = '/(resident)';

test.describe('TenisX Design System — v1.0 enforcement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  // ── Navigation structure ─────────────────────────────────────────────────────

  test('exactly 5 resident tabs visible', async ({ page }) => {
    await expect(page.locator('[data-testid^="tab-"]')).toHaveCount(5, { timeout: 10000 });
  });

  test('exactly one bottom nav exists', async ({ page }) => {
    await expect(page.locator('[data-testid="bottom-nav"]')).toHaveCount(1);
  });

  test('correct tab labels for the active product mode', async ({ page }) => {
    const nav = page.locator('[data-testid="bottom-nav"]');
    // Tennis: HOME · RESERVE · VS (glyph) · COACHES · ME; Community: HOME · RESERVE · COMMUNITY · SCHEDULE · ME
    const labels = isCommunityMode ? ['HOME', 'RESERVE', 'COMMUNITY', 'SCHEDULE'] : ['HOME', 'RESERVE', 'COACHES'];
    for (const label of labels) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
    if (isTennisMode) await expect(page.locator('[data-testid="tab-match"]').getByText('VS')).toBeVisible();
    await expect(page.locator('[data-testid="tab-me"]').getByText('ME', { exact: true })).toBeVisible();
  });

  test('old tabs not visible: BOOK, REPORTS, DOCS', async ({ page }) => {
    const nav = page.locator('[data-testid="bottom-nav"]');
    await expect(nav.getByText('BOOK', { exact: true })).toHaveCount(0);
    await expect(nav.getByText('REPORTS', { exact: true })).toHaveCount(0);
    await expect(nav.getByText('DOCS', { exact: true })).toHaveCount(0);
  });

  test('tab bar height meets 72px minimum', async ({ page }) => {
    const nav = page.locator('[data-testid="bottom-nav"]');
    const box = await nav.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(72);
  });

  test('tab touch zones are at least 44px wide', async ({ page }) => {
    const tabs = page.locator('[data-testid^="tab-"]');
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      if (box) expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  // ── Universal header ─────────────────────────────────────────────────────────

  test('TenisX logo visible in universal header', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible();
  });

  test('notification bell visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible();
  });

  test('profile avatar icon visible', async ({ page }) => {
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible();
  });

  test('bell icon touch zone meets 44px minimum', async ({ page }) => {
    const bell = page.locator('[data-testid="bell-icon"]');
    const box = await bell.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('avatar icon touch zone meets 44px minimum', async ({ page }) => {
    const menu = page.locator('[data-testid="avatar-icon"]');
    const box = await menu.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  // ── Home screen content ──────────────────────────────────────────────────────

  test('Home screen loads', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible({ timeout: 15000 });
  });

  test('Book Court quick action visible and navigates', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-book-court"]')).toBeVisible();
    await page.locator('[data-testid="quick-book-court"]').click();
    await expect(page).toHaveURL(/courts/, { timeout: 15000 });
  });

  test('Find Match quick action visible and navigates (tennis mode only)', async ({ page }) => {
    test.skip(!isTennisMode, 'tennis-only; see Community Report Issue test');
    await page.goto(HOME);
    await expect(page.locator('[data-testid="quick-find-match"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="quick-find-match"]').click();
    await expect(page).toHaveURL(/match/, { timeout: 15000 });
  });

  test('Find Coach quick action visible and navigates (tennis mode only)', async ({ page }) => {
    test.skip(!isTennisMode, 'tennis-only; see Community Report Issue test');
    await page.goto(HOME);
    await expect(page.locator('[data-testid="quick-find-coach"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="quick-find-coach"]').click();
    await expect(page).toHaveURL(/coaches/, { timeout: 15000 });
  });

  test('Report Issue quick action visible (community mode only)', async ({ page }) => {
    test.skip(!isCommunityMode, 'tennis build shows Find Match / Find Coach');
    await expect(page.locator('[data-testid="quick-report-issue"]')).toBeVisible({ timeout: 15000 });
  });

  test('View Full Schedule navigates to calendar', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('[data-testid="calendar-link"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="calendar-link"]').click();
    await expect(page).toHaveURL(/calendar/, { timeout: 15000 });
  });

  test('quick action buttons meet 48px min height', async ({ page }) => {
    const ids = isCommunityMode
      ? ['quick-book-court', 'quick-report-issue']
      : ['quick-book-court', 'quick-find-match', 'quick-find-coach'];
    for (const id of ids) {
      const el = page.locator(`[data-testid="${id}"]`);
      await expect(el).toBeVisible({ timeout: 15000 });
      const box = await el.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('next court / upcoming reservation card renders', async ({ page }) => {
    const id = isCommunityMode ? 'upcoming-reservation-card' : 'next-court-card';
    await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible({ timeout: 15000 });
  });

  test('calendar link is tappable (≥48px height)', async ({ page }) => {
    const box = await page.locator('[data-testid="calendar-link"]').boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(48);
  });

  // ── HOA-first content absent ─────────────────────────────────────────────────

  test('HOA-first sections absent from Home', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('Community Events', { exact: true })).toHaveCount(0);
    await expect(page.getByText('My Open Reports', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Book an Amenity', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-testid="hoa-name"]')).toHaveCount(0);
  });

  // ── Community announcement interaction ───────────────────────────────────────

  test('community pulse announcements navigate when tapped', async ({ page }) => {
    await page.waitForTimeout(3000);
    const pulseCard = page.locator('[data-testid="community-pulse-card"]');
    const count = await pulseCard.count();
    if (count > 0) {
      // Find a tappable row inside the pulse card and click it
      const row = pulseCard.locator('[role="button"], a').first();
      const rowCount = await row.count();
      if (rowCount > 0) {
        await row.click();
        await expect(page).toHaveURL(/announcements/, { timeout: 15000 });
      }
    }
    // If no announcements, test passes vacuously
  });

  // ── Cross-tab navigation ─────────────────────────────────────────────────────

  test('Courts tab navigates and shows universal header', async ({ page }) => {
    await page.locator('[data-testid="tab-courts"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Match tab navigates and shows universal header (tennis mode only)', async ({ page }) => {
    test.skip(!isTennisMode, 'Match tab is tennis-only');
    await page.locator('[data-testid="tab-match"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Coaches tab navigates and shows universal header (tennis mode only)', async ({ page }) => {
    test.skip(!isTennisMode, 'Coaches tab is tennis-only');
    await page.locator('[data-testid="tab-coaches"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Community tab navigates and shows universal header (community mode only)', async ({ page }) => {
    test.skip(!isCommunityMode, 'Community tab is community-only');
    await page.locator('[data-testid="tab-community"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('Me tab navigates and shows universal header', async ({ page }) => {
    await page.locator('[data-testid="tab-me"]').click();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 15000 });
  });
});
