import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';
import { communityToday } from '../src/lib/communityTime';

/**
 * First come, first served in the Reserve picker (real browser, MOCKED availability): another resident's pending request is
 * drawn as reserved (it holds the time), my own pending request as "Pending", and a server without the busy-times function
 * says so instead of drawing everything free. The database rules themselves are proven by supabase/tests/reservation_integrity.sql.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function openTomorrow(page: Page) {
  await page.goto('/(resident)/courts');
  await page.waitForTimeout(4000);
  await page.locator('[data-testid^="court-cta-"]').first().click({ timeout: 30000 });
  await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-testid="sheet-date-1"]').click();
  await expect(page.locator('[data-testid="time-slot-wheel"]')).toBeVisible({ timeout: 20000 });
}

test.describe('Pending requests hold the time (mocked availability)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHostedWrites(page);
    await page.route(/\/rest\/v1\/court_maintenance\?/, (route) => route.fulfill(json([])));
    await page.route(/\/rest\/v1\/bookings\?/, (route) => (route.request().method() === 'GET' ? route.fulfill(json([])) : route.fallback()));
  });

  test('another resident\'s PENDING request is unavailable (gray "Reserved"); my own pending request reads "Pending"', async ({ page }) => {
    const tomorrow = (() => { const d = new Date(`${communityToday()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
    await page.route(/\/rest\/v1\/rpc\/get_amenity_busy_times/, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { p_court_ids: string[]; p_date: string };
      const court = body.p_court_ids[0];
      const rows = body.p_date === tomorrow && court
        ? [
            { court_id: court, start_time: '10:00:00', end_time: '11:00:00', status: 'pending', is_mine: false, counts_toward_cap: false },
            { court_id: court, start_time: '14:00:00', end_time: '15:00:00', status: 'pending', is_mine: true, counts_toward_cap: true },
          ]
        : [];
      await route.fulfill(json(rows));
    });
    await openTomorrow(page);
    const other = page.locator('[data-testid="wheel-unavailable-10:00"]');
    await expect(other).toBeVisible({ timeout: 20000 });
    await expect(other).toContainText('Reserved');
    await expect(other).not.toContainText('Yours');
    await expect(other).not.toContainText('Pending');
    const mine = page.locator('[data-testid="wheel-unavailable-14:00"]');
    await expect(mine).toContainText('Pending');
    await expect(mine).toHaveAttribute('aria-label', /pending approval/);
    // both are disabled rows: no Select button for them
    await expect(page.locator('[data-testid="wheel-select-10:00"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wheel-select-14:00"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="availability-legend"]')).not.toContainText("aren't shown yet");
  });

  test('a server without the busy-times function says other reservations cannot be shown (never "everything free" silently)', async ({ page }) => {
    await page.route(/\/rest\/v1\/rpc\/get_amenity_busy_times/, (route) =>
      route.fulfill(json({ code: 'PGRST202', message: 'Could not find the function public.get_amenity_busy_times in the schema cache' }, 404)));
    await openTomorrow(page);
    await expect(page.locator('[data-testid="availability-legend"]')).toContainText("aren't shown yet", { timeout: 20000 });
  });

  test('a taken-moments-ago insert shows the plain "just taken" message', async ({ page }) => {
    await page.route(/\/rest\/v1\/rpc\/get_amenity_busy_times/, (route) => route.fulfill(json([])));
    await page.route(/\/rest\/v1\/bookings(\?|$)/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill(json({ code: '23P01', message: 'conflicting key value violates exclusion constraint "bookings_no_overlapping_active"' }, 409));
    });
    await openTomorrow(page);
    await page.locator('[data-testid^="wheel-select-"]').first().evaluate((el: HTMLElement) => el.click());
    await page.locator('[data-testid="confirm-booking-btn"]').click();
    await expect(page.locator('[data-testid="booking-error"]')).toContainText(/just taken by another reservation or pending request/i, { timeout: 20000 });
  });
});
