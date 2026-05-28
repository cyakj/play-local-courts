import { test, expect } from '@playwright/test';

const HOME = '/(resident)/';

test.describe('Resident Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    await page.waitForLoadState('domcontentloaded');
    // Wait until the resident header is rendered
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  test('TenisX logo is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu icon is visible in header', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('greeting text is visible (Good morning/afternoon/evening)', async ({ page }) => {
    const greeting = page.getByText(/Good (morning|afternoon|evening),/i);
    await expect(greeting.first()).toBeVisible({ timeout: 15000 });
  });

  test('HOA community name is visible in hero', async ({ page }) => {
    // hoaName fetched from Supabase and rendered below greeting
    await expect(page.locator('[data-testid="hoa-name"]')).toBeVisible({ timeout: 30000 });
  });

  test('Community Announcements section header is visible', async ({ page }) => {
    await expect(page.getByText('Community Announcements')).toBeVisible({ timeout: 20000 });
  });

  test('at least one announcement is shown (not empty)', async ({ page }) => {
    // Wait for either a real row (data loaded) or the empty state (no data)
    await expect(
      page.locator('[data-testid="announcement-row"]').first()
        .or(page.getByText('No announcements yet'))
    ).toBeVisible({ timeout: 20000 });
    // The test HOA has announcement data — assert a row is present
    await expect(page.locator('[data-testid="announcement-row"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Upcoming Reservations section header is visible', async ({ page }) => {
    await expect(page.getByText('Upcoming Reservations', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('Upcoming Reservations shows content or empty state (not broken)', async ({ page }) => {
    // Wait for loading to finish — either real rows or the empty-state appear
    await expect(page.getByText('No upcoming reservations').or(
      page.locator('[data-testid="booking-row"]').first()
    )).toBeVisible({ timeout: 20000 });
  });

  test('bottom tab bar is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 10000 });
  });

  test('all 5 bottom tabs are visible with correct labels', async ({ page }) => {
    const labels = ['HOME', 'BOOK', 'REPORTS', 'CALENDAR', 'DOCS'];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
  });

  // ── New: View All / View Results CTAs ─────────────────────────────────────

  test('"View All →" link is visible in Community Announcements header', async ({ page }) => {
    await expect(page.locator('[data-testid="announcements-view-all"]')).toBeVisible({ timeout: 20000 });
  });

  // ── New: Scroll behaviour ─────────────────────────────────────────────────

  test('hero greeting scrolls away — Y position moves up after scrolling', async ({ page }) => {
    // Wait for the greeting to appear
    const greeting = page.getByText(/Good (morning|afternoon|evening),/i).first();
    await expect(greeting).toBeVisible({ timeout: 20000 });
    // Record initial Y position
    const boxBefore = await greeting.boundingBox();
    // Scroll every overflow-scroll/auto container in the page (React Native Web ScrollView)
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const s = window.getComputedStyle(el);
        if (/(scroll|auto)/.test(s.overflow + s.overflowY)) el.scrollTop = 600;
      });
    });
    await page.waitForTimeout(400);
    // The greeting element should now have a smaller (more negative) Y value
    const boxAfter = await greeting.boundingBox();
    // Logo (sticky header) stays visible after scroll
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 5000 });
    // Greeting moved up (scrolled away from its original position)
    expect(boxAfter!.y).toBeLessThan(boxBefore!.y);
  });

  // ── New: Section header prominence ────────────────────────────────────────

  test('section card titles are present and prominent', async ({ page }) => {
    // All three main card section titles should be visible
    await expect(page.getByText('Upcoming Reservations', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Community Announcements', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Community Events', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
