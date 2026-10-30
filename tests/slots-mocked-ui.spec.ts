import { test, expect } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * V1-012 live rendering with MOCKED availability (no hosted data is created): a reservation and a blockout are
 * injected into the GET responses for tomorrow, then the booking sheet must show those times as visible, disabled
 * rows with the right labels, no Select button, and keep other times selectable.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const tomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

test.describe('Reservation sheet: unavailable slots stay visible but disabled (mocked availability)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHostedWrites(page);
    // The test resident may already hold a real booking tomorrow (with a one-per-day cap every other time would correctly
    // show as a limit). Hide their own bookings so this test exercises reserved / blocked / open in isolation.
    await page.route(/\/rest\/v1\/bookings\?.*user_id=eq\./, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // someone else's reservation 10:00-11:00 tomorrow, for whichever court the sheet asks about
    await page.route(/\/rest\/v1\/bookings\?.*court_id=in\./, async (route) => {
      const url = new URL(route.request().url());
      const courtIds = (url.searchParams.get('court_id') ?? '').replace(/^in\.\(|\)$/g, '').split(',').filter(Boolean);
      const date = (url.searchParams.get('date') ?? '').replace('eq.', '');
      const body = date === tomorrow && courtIds[0]
        ? [{ court_id: courtIds[0], start_time: '10:00:00', end_time: '11:00:00', user_id: '00000000-0000-0000-0000-000000000001' }]
        : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    // management blockout 14:00-15:00 tomorrow
    await page.route(/\/rest\/v1\/court_maintenance\?.*court_id=eq\./, async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ date: tomorrow, end_date: null, start_time: '14:00:00', end_time: '15:00:00', description: 'Resurfacing' }]),
      });
    });
    await page.goto('/(resident)/courts');
  });

  test('a reservation and a blockout render as disabled rows with labels; open times keep Select', async ({ page }) => {
    await page.waitForTimeout(4000);
    const btn = page.locator('[data-testid^="court-cta-"]').first();
    await btn.click({ timeout: 30000 });
    await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-testid="sheet-date-1"]').click();
    await expect(page.locator('[data-testid="time-slot-wheel"]')).toBeVisible({ timeout: 20000 });

    // reserved: 10:00 overlaps the reservation -> unavailable pill labelled Reserved, no Select button
    const reserved = page.locator('[data-testid="wheel-unavailable-10:00"]');
    await expect(reserved).toBeVisible({ timeout: 15000 });
    await expect(reserved).toContainText('Reserved');
    await expect(page.locator('[data-testid="wheel-select-10:00"]')).toHaveCount(0);

    // blocked: 14:00 -> pill labelled Blocked, no Select button
    const blocked = page.locator('[data-testid="wheel-unavailable-14:00"]');
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('Blocked');
    await expect(page.locator('[data-testid="wheel-select-14:00"]')).toHaveCount(0);

    // other times still selectable, and the legend is shown
    await expect.poll(() => page.locator('[data-testid^="wheel-select-"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-testid="availability-legend"]')).toBeVisible();

    // selecting an open time enables the confirm button; unavailable rows cannot be selected at all
    // far rows are scaled/faded by the wheel's cylinder effect, so click through the DOM instead of by pointer
    await page.locator('[data-testid^="wheel-select-"]').first().evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('[data-testid="selected-time-summary"]')).toBeVisible();
    await reserved.click({ force: true }).catch(() => undefined);
    await expect(page.locator('[data-testid="selected-time-summary"]')).not.toContainText('10:00 AM');
  });
});
