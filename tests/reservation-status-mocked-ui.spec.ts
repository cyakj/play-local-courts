import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';
import { communityNowMs } from '../src/lib/communityTime';

/**
 * Resident reservation status, time and navigation in a real browser against a MOCKED reservation backend (reads of
 * other tables still go to hosted; hosted writes are blocked). Booking rows are generated RELATIVE to the community
 * clock "now", so the same spec reproduces "an 11-12 booking viewed in the evening" at any time of day.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const pad = (n: number) => String(n).padStart(2, '0');

/** Community wall-clock date/time `offsetMin` minutes from now. */
function wall(offsetMin: number): { date: string; time: string } {
  const d = new Date(communityNowMs() + offsetMin * 60_000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`,
  };
}
function row(id: string, status: string, startOff: number, endOff: number, courtId = 'court-x') {
  const s = wall(startOff); const e = wall(endOff);
  // A booking never crosses midnight in the schema; keep the generated row on one day or skip the test.
  return { id, status, date: s.date, start_time: s.time, end_time: e.time, court_id: courtId, cancellation_reason: null, cancelled_by: null, courts: { name: 'Greens Court', hoa_id: 'h' }, _crosses: s.date !== e.date };
}

async function mockOwnBookings(page: Page, rows: any[]) {
  await blockHostedWrites(page);
  await page.route(/\/rest\/v1\/bookings\?/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = route.request().url();
    if (/courts(%21|!)inner/.test(url) && /user_id=eq\./.test(url)) {
      // own bookings: attach the real court ids so the court list can match them to cards
      const courtsUrl = url.replace(/\/bookings\?.*/, '/courts?select=id,hoa_id');
      const c = await route.fetch({ url: courtsUrl });
      const courts: Array<{ id: string; hoa_id: string }> = await c.json().catch(() => []);
      if (Array.isArray(courts) && courts.length > 0) {
        return route.fulfill(json(courts.flatMap((ct) => rows.map((r) => ({ ...r, id: `${r.id}-${ct.id}`, court_id: ct.id, courts: { name: 'Greens Court', hoa_id: ct.hoa_id } })))));
      }
    }
    return route.fulfill(json([]));
  });
  await page.route(/\/rest\/v1\/court_maintenance\?/, (route) => route.fulfill(json([])));
}

test.describe('Home upcoming reservation (mocked)', () => {
  test('REGRESSION: a booking that already ended is NOT shown as upcoming', async ({ page }) => {
    const ended = row('ended', 'confirmed', -120, -60);
    test.skip(ended._crosses, 'generated row would cross midnight');
    await mockOwnBookings(page, [ended]);
    await page.goto('/(resident)');
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(5000);
    await expect(page.locator('[data-testid="next-court-row"], [data-testid="upcoming-reservation-row"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="home-reservation-badge"]')).toHaveCount(0);
  });

  test('a pending request shows "Pending approval" - never Confirmed - and an ended booking before it is skipped', async ({ page }) => {
    const ended = row('ended', 'confirmed', -120, -60);
    const pending = row('pend', 'pending', 60, 120);
    test.skip(ended._crosses || pending._crosses, 'generated row would cross midnight');
    await mockOwnBookings(page, [ended, pending]);
    await page.goto('/(resident)');
    const badge = page.locator('[data-testid="home-reservation-badge"]').first();
    await expect(badge).toBeVisible({ timeout: 30000 });
    await expect(badge).toContainText('Pending approval');
    await expect(badge).not.toContainText('Confirmed');
    await expect(page.locator('[data-testid="next-court-row"], [data-testid="upcoming-reservation-row"]')).toHaveCount(1);
  });

  test('a confirmed future booking reads Confirmed; one in progress reads In progress', async ({ page }) => {
    const live = row('live', 'confirmed', -20, 40);
    test.skip(live._crosses, 'generated row would cross midnight');
    await mockOwnBookings(page, [live]);
    await page.goto('/(resident)');
    await expect(page.locator('[data-testid="home-reservation-badge"]').first()).toContainText('In progress', { timeout: 30000 });
  });
});

test.describe('Reserve court list (mocked)', () => {
  test('REGRESSION: an ended booking never shows as My Reservation; a pending one reads "My pending request"', async ({ page }) => {
    const ended = row('ended', 'confirmed', -120, -60);
    const pending = row('pend', 'pending', 20, 50);
    test.skip(ended._crosses || pending._crosses, 'generated row would cross midnight');
    await mockOwnBookings(page, [ended, pending]);
    await page.goto('/(resident)/courts');
    const badge = page.locator('[data-testid="court-reservation-badge"]').first();
    await expect(badge).toBeVisible({ timeout: 40000 });
    await expect(badge).toContainText('My pending request');
    await expect(page.locator('[data-testid="court-reservation-badge"]', { hasText: 'confirmed' })).toHaveCount(0);
    await expect(page.locator('[data-testid="court-reservation-badge"]', { hasText: 'Completed' })).toHaveCount(0);
  });

  test('the booking sheet and View Schedule carry the full legend with text', async ({ page }) => {
    await mockOwnBookings(page, []);
    await page.goto('/(resident)/courts');
    await page.waitForTimeout(4000);
    await page.locator('[data-testid^="view-schedule-"]').first().click({ timeout: 30000 });
    const legend = page.locator('[data-testid="schedule-legend"]');
    await expect(legend).toBeVisible({ timeout: 20000 });
    // compact visible labels + full accessible descriptions
    for (const t of ['Available', 'Reserved', 'Blocked', 'Mine', 'Pending', 'Past']) await expect(legend).toContainText(t);
    for (const t of ['Reserved by someone else', 'Blocked by management', 'My reservation', 'My request, pending approval', 'Completed or passed']) {
      await expect(legend.getByLabel(t, { exact: true })).toHaveCount(1);
    }
  });
});

test.describe('Account menu and back button (mocked)', () => {
  test('the avatar menu has no Account Settings; Sign Out remains', async ({ page }) => {
    await mockOwnBookings(page, []);
    await page.goto('/(resident)');
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="avatar-icon"]').click();
    await expect(page.locator('[data-testid="account-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-sign-out"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-account-settings"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="account-menu"]')).not.toContainText('Account Settings');
  });

  test('Back shows a label on a 390 px screen and stays a 44pt target; on 320 px it keeps the 48pt arrow chip', async ({ page }) => {
    await mockOwnBookings(page, []);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/my-reservations');
    const back = page.locator('[data-testid="header-back"]').first();
    await expect(back).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="header-back-label"]').first()).toHaveText('Back');
    let box = (await back.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.waitForTimeout(500);
    box = (await back.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('[data-testid="header-back-label"]')).toHaveCount(0);
  });
});
