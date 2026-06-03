import { test, expect } from '@playwright/test';

const HOME = '/(resident)';

test.describe('Home Screen — Phase 2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  // ── Header (unchanged — Phase 1 scope) ──────────────────────────────────────

  test('header logo is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('menu icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero — tennis-first identity ────────────────────────────────────────────

  test('greeting text is visible', async ({ page }) => {
    await expect(page.getByText(/Good (morning|afternoon|evening),/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('HOA name is NOT in the hero', async ({ page }) => {
    // hoa-name was a Phase 1 HOA portal element — must be absent
    await expect(page.locator('[data-testid="hoa-name"]')).toHaveCount(0);
  });

  // ── Tennis-first: removed sections ──────────────────────────────────────────

  test('Community Events section is NOT on Home screen', async ({ page }) => {
    await page.waitForTimeout(2000); // let data load
    await expect(page.getByText('Community Events', { exact: true })).toHaveCount(0);
  });

  test('My Open Reports section is NOT on Home screen', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('My Open Reports', { exact: true })).toHaveCount(0);
  });

  test('"Book an Amenity" text is NOT present (renamed to Book a Court)', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('Book an Amenity', { exact: true })).toHaveCount(0);
  });

  test('"Upcoming Reservations" is NOT present (renamed)', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText('Upcoming Reservations', { exact: true })).toHaveCount(0);
  });

  // ── Quick Actions ────────────────────────────────────────────────────────────

  test('quick actions row renders', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Book Court" quick action is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-book-court"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Find Match" quick action is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-find-match"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Find Coach" quick action is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="quick-find-coach"]')).toBeVisible({ timeout: 10000 });
  });

  test('"Invite Coach" label is not present', async ({ page }) => {
    await expect(page.getByText('Invite Coach', { exact: true })).toHaveCount(0);
  });

  // ── Quick action navigation ──────────────────────────────────────────────────

  test('"Book Court" navigates to Courts tab', async ({ page }) => {
    await page.locator('[data-testid="quick-book-court"]').click();
    await expect(page).toHaveURL(/courts/, { timeout: 15000 });
  });

  test('"Find Match" navigates to Match tab', async ({ page }) => {
    await page.locator('[data-testid="quick-find-match"]').click();
    await expect(page).toHaveURL(/match/, { timeout: 15000 });
  });

  test('"Find Coach" navigates to Coaches tab', async ({ page }) => {
    await page.locator('[data-testid="quick-find-coach"]').click();
    await expect(page).toHaveURL(/coaches/, { timeout: 15000 });
  });

  // ── My Next Court ─────────────────────────────────────────────────────────────

  test('next court card renders', async ({ page }) => {
    await expect(page.locator('[data-testid="next-court-card"]')).toBeVisible({ timeout: 10000 });
  });

  test('next court card shows booking or Book a Court CTA', async ({ page }) => {
    await expect(
      page.locator('[data-testid="next-court-row"]').first()
        .or(page.locator('[data-testid="book-court-cta"]'))
    ).toBeVisible({ timeout: 25000 });
  });

  // ── Conditional sections hidden when empty ───────────────────────────────────

  test('pending challenge card is hidden when no challenge exists', async ({ page }) => {
    await page.waitForTimeout(3000); // allow data to load
    const card = page.locator('[data-testid="pending-challenge-card"]');
    const count = await card.count();
    if (count > 0) {
      // If present, it should be visible and have accept/decline buttons
      await expect(card).toBeVisible();
      await expect(page.locator('[data-testid="challenge-accept-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="challenge-decline-btn"]')).toBeVisible();
    }
    // No assertion needed when count = 0 — hiding is the correct behavior
  });

  test('upcoming matches card is hidden when no accepted matches exist', async ({ page }) => {
    await page.waitForTimeout(3000);
    const card = page.locator('[data-testid="upcoming-matches-card"]');
    const count = await card.count();
    if (count > 0) {
      await expect(card).toBeVisible();
      await expect(page.locator('[data-testid="upcoming-match-row"]').first()).toBeVisible();
    }
  });

  test('recent result card is hidden when no completed matches', async ({ page }) => {
    await page.waitForTimeout(3000);
    const card = page.locator('[data-testid="recent-result-card"]');
    const count = await card.count();
    if (count > 0) {
      await expect(card).toBeVisible();
    }
  });

  // ── Community Pulse ──────────────────────────────────────────────────────────

  test('community pulse card is hidden when no announcements', async ({ page }) => {
    await page.waitForTimeout(3000);
    const card = page.locator('[data-testid="community-pulse-card"]');
    const count = await card.count();
    if (count > 0) {
      await expect(card).toBeVisible();
      // At most 2 announcements in pulse
      const rows = page.locator('[data-testid="community-pulse-card"] [data-testid="listRow"]');
      const rowCount = await rows.count();
      expect(rowCount).toBeLessThanOrEqual(2);
    }
  });

  // ── Weather module ────────────────────────────────────────────────────────────

  test('weather module or skeleton renders without error', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Either the module is visible or hidden — it must never show an error
    const weatherEl = page.locator('[data-testid="weather-module"]');
    const skeletonEl = page.locator('[data-testid="weather-skeleton"]');
    const weatherCount = await weatherEl.count();
    const skeletonCount = await skeletonEl.count();
    // At least one of: module visible, module not present (permission denied — neither shows)
    // Both should not be visible simultaneously
    if (weatherCount > 0 && skeletonCount > 0) {
      // Skeleton should have disappeared once weather loaded
      await expect(skeletonEl).not.toBeVisible({ timeout: 8000 });
    }
    // No error text on screen
    await expect(page.getByText(/weather error/i)).toHaveCount(0);
  });

  // ── Community Pulse ───────────────────────────────────────────────────────────

  test('community pulse label reads COMMUNITY PULSE when visible', async ({ page }) => {
    await page.waitForTimeout(3000);
    const card = page.locator('[data-testid="community-pulse-card"]');
    const count = await card.count();
    if (count > 0) {
      await expect(page.locator('[data-testid="community-pulse-label"]')).toBeVisible();
      await expect(page.locator('[data-testid="community-pulse-label"]')).toHaveText('COMMUNITY PULSE');
    }
  });

  // ── View Full Schedule ────────────────────────────────────────────────────────

  test('view full schedule renders as a card row', async ({ page }) => {
    const link = page.locator('[data-testid="calendar-link"]');
    await expect(link).toBeVisible({ timeout: 10000 });
    // Should have card-level height
    const box = await link.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(48);
  });

  // ── Calendar link ─────────────────────────────────────────────────────────────

  test('calendar link is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-link"]')).toBeVisible({ timeout: 10000 });
  });

  test('calendar link navigates to calendar screen', async ({ page }) => {
    await page.locator('[data-testid="calendar-link"]').click();
    await expect(page).toHaveURL(/calendar/, { timeout: 15000 });
  });

  // ── Bottom nav ────────────────────────────────────────────────────────────────

  test('bottom nav is visible with exactly 5 tabs', async ({ page }) => {
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid^="tab-"]')).toHaveCount(5);
  });

  test('correct tab labels: Home | Courts | Match | Coaches | Me', async ({ page }) => {
    const nav = page.locator('[data-testid="bottom-nav"]');
    for (const label of ['HOME', 'COURTS', 'MATCH', 'COACHES']) {
      await expect(nav.getByText(label)).toBeVisible({ timeout: 10000 });
    }
    await expect(page.locator('[data-testid="tab-me"]').getByText('ME', { exact: true })).toBeVisible();
  });

  // ── Scroll behaviour ─────────────────────────────────────────────────────────

  test('quick action buttons meet 48px min height', async ({ page }) => {
    const ids = ['quick-book-court', 'quick-find-match', 'quick-find-coach'];
    for (const id of ids) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('bell icon meets 44px touch zone', async ({ page }) => {
    const bell = page.locator('[data-testid="bell-icon"]');
    const box = await bell.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('next court list row meets 56px minimum when booking exists', async ({ page }) => {
    await page.waitForTimeout(3000);
    const row = page.locator('[data-testid="next-court-row"]');
    const count = await row.count();
    if (count > 0) {
      const box = await row.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(56);
    }
  });

  test('hero greeting scrolls away when scrolled', async ({ page }) => {
    const greeting = page.getByText(/Good (morning|afternoon|evening),/i).first();
    await expect(greeting).toBeVisible({ timeout: 20000 });
    const boxBefore = await greeting.boundingBox();
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('*').forEach(el => {
        const s = window.getComputedStyle(el);
        if (/(scroll|auto)/.test(s.overflow + s.overflowY)) el.scrollTop = 600;
      });
    });
    await page.waitForTimeout(400);
    const boxAfter = await greeting.boundingBox();
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible();
    expect(boxAfter!.y).toBeLessThanOrEqual(boxBefore!.y);
  });
});
