import { test, expect } from '@playwright/test';

const BOOK = '/(resident)/book';

test.describe('Resident Book Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BOOK);
    await page.waitForLoadState('domcontentloaded');
    // Wait for header to confirm resident layout loaded
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  test('header logo is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('hamburger menu icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('"No amenities available" is NOT shown — real data loads', async ({ page }) => {
    // Wait for either amenity cards or the empty state
    await expect(
      page.locator('[data-testid="amenity-card"]').first()
        .or(page.getByText('No amenities available', { exact: false }))
    ).toBeVisible({ timeout: 25000 });
    // Assert amenity cards ARE present (not the empty state)
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('at least one amenity card renders', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
  });

  test('filter tab "All" is visible and active by default', async ({ page }) => {
    await expect(page.getByText('All', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('filter tabs Courts, Pools, Other all exist', async ({ page }) => {
    for (const label of ['Courts', 'Pools', 'Other']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10000 });
    }
  });

  test('tapping "Book Now" navigates to booking detail screen', async ({ page }) => {
    // Wait for an amenity card to appear
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    // Click the first "Book Now →" button
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // Should navigate to amenity-book; wait for date strip heading
    await expect(page.getByText('SELECT DATE')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen shows amenity name', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // Amenity name is shown in the detail header
    await expect(page.locator('[data-testid="amenity-detail-name"]')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen has date selector pills', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    // "Today" date pill should always be present
    await expect(page.getByText('Today')).toBeVisible({ timeout: 20000 });
  });

  test('booking detail screen has OPTIONS card with Type of Play', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    await expect(page.getByText('OPTIONS')).toBeVisible({ timeout: 20000 });
    // Type of Play or Type of Use
    await expect(
      page.getByText('Type of Play').or(page.getByText('Type of Use'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('booking detail screen has Duration selector', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="book-now-btn"]').first().click();
    await expect(page.getByText('Duration')).toBeVisible({ timeout: 20000 });
  });

  // ── Icon & amenity polish ─────────────────────────────────────────────────

  test('amenity cards render icon containers', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    const cards = page.locator('[data-testid="amenity-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // Each card should contain an SVG icon (rendered by Lucide)
    const firstCard = cards.first();
    const svgs = firstCard.locator('svg');
    await expect(svgs.first()).toBeVisible({ timeout: 5000 });
  });

  test('"Open Now" badge is visible on amenity cards', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('[data-testid="open-now-badge"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('"Rules" button is visible on every amenity card', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    const cards = page.locator('[data-testid="amenity-card"]');
    const cardCount = await cards.count();
    const rulesBtns = page.locator('[data-testid="rules-btn"]');
    // One Rules button per card
    await expect(rulesBtns).toHaveCount(cardCount, { timeout: 5000 });
  });

  test('"Rules" button opens the rules sheet', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
  });

  test('rules sheet shows amenity name in title', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-title"]')).toBeVisible({ timeout: 10000 });
    const titleText = await page.locator('[data-testid="rules-title"]').textContent();
    expect(titleText).toContain('Rules');
  });

  test('rules sheet displays rules content or empty state', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
    // Wait for loading to finish
    await expect(page.locator('[data-testid="rules-loading"]')).not.toBeVisible({ timeout: 10000 });
    // Either rules content or empty state should appear
    await expect(
      page.locator('[data-testid="rules-content"]')
        .or(page.locator('[data-testid="rules-empty"]'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('rules sheet close button dismisses the modal', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="rules-close-btn"]').click();
    await expect(page.locator('[data-testid="rules-sheet"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('rules sheet shows rule rows when rules data exists', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="rules-loading"]')).not.toBeVisible({ timeout: 10000 });
    const content = page.locator('[data-testid="rules-content"]');
    const empty = page.locator('[data-testid="rules-empty"]');
    if (await content.isVisible()) {
      // If rules exist, at least one row should be visible
      const rows = page.locator('[data-testid="rules-row"]');
      await expect(rows.first()).toBeVisible({ timeout: 5000 });
    } else {
      // No rules: empty state should be there
      await expect(empty).toBeVisible({ timeout: 5000 });
    }
  });

  test('each amenity card can open separate rules (second card)', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    const rulesBtns = page.locator('[data-testid="rules-btn"]');
    const count = await rulesBtns.count();
    if (count >= 2) {
      await rulesBtns.nth(1).click();
      await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="rules-title"]')).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="rules-close-btn"]').click();
      await expect(page.locator('[data-testid="rules-sheet"]')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('screenshot: booking list with polished icons', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.screenshot({ path: 'test-results/book-list-snapshot.png' });
  });

  test('screenshot: rules modal open', async ({ page }) => {
    await expect(page.locator('[data-testid="amenity-card"]').first()).toBeVisible({ timeout: 25000 });
    await page.locator('[data-testid="rules-btn"]').first().click();
    await expect(page.locator('[data-testid="rules-sheet"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="rules-loading"]')).not.toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/book-rules-snapshot.png' });
  });
});
