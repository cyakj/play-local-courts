import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Reserve and cancel in a real browser against a MOCKED backend: the insert / update requests are CAPTURED and answered
 * locally, so no booking is created or cancelled on hosted. Proves the UI sends exactly one well-formed request, blocks
 * a double tap, and shows the outcome. Server-side rules (exclusion constraint, limits, cancellation window) are proven
 * elsewhere (migration rehearsal), not here.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return key(d); })();
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Reserving (mocked)', () => {
  async function setup(page: Page, insertStatus: 'confirmed' | 'pending' | 'conflict' = 'confirmed') {
    await blockHostedWrites(page);
    const inserts: any[] = [];
    // no existing reservations, so tomorrow is fully open (own bookings hidden too, so no per-day cap applies)
    await page.route(/\/rest\/v1\/bookings\?/, async (route) => {
      const req = route.request();
      if (req.method() === 'GET') return route.fulfill(json([]));
      return route.fallback();
    });
    await page.route(/\/rest\/v1\/bookings(\?|$)/, async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      inserts.push(JSON.parse(req.postData() ?? '{}'));
      if (insertStatus === 'conflict') {
        return route.fulfill(json({ code: '23P01', message: 'conflicting key value violates exclusion constraint' }, 409));
      }
      return route.fulfill(json({ status: insertStatus })); // .single() asks for an object
    });
    await page.route(/\/rest\/v1\/court_maintenance\?/, (route) => route.fulfill(json([])));
    await page.goto('/(resident)/courts');
    await page.waitForTimeout(4000);
    await page.locator('[data-testid^="court-cta-"]').first().click({ timeout: 30000 });
    await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-testid="sheet-date-1"]').click();
    await expect(page.locator('[data-testid="time-slot-wheel"]')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-testid^="wheel-select-"]').first().evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('[data-testid="selected-time-summary"]')).toBeVisible();
    return inserts;
  }

  test('confirm sends exactly ONE well-formed insert for the chosen time and shows success', async ({ page }) => {
    const inserts = await setup(page, 'confirmed');
    await page.locator('[data-testid="confirm-booking-btn"]').click();
    await expect(page.locator('[data-testid="confirm-booking-btn"]')).toContainText('Booked', { timeout: 20000 });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ date: tomorrow, status: 'confirmed' });
    expect(inserts[0].start_time).toMatch(/^\d{2}:\d{2}:00$/);
    expect(inserts[0].end_time > inserts[0].start_time).toBe(true);
    expect(typeof inserts[0].user_id).toBe('string');
    expect(typeof inserts[0].court_id).toBe('string');
  });

  test('REGRESSION: a rapid double tap on Confirm cannot create two reservations', async ({ page }) => {
    const inserts = await setup(page, 'confirmed');
    const btn = page.locator('[data-testid="confirm-booking-btn"]');
    await Promise.all([btn.click(), btn.click({ force: true }).catch(() => undefined), btn.click({ force: true }).catch(() => undefined)]);
    await expect(btn).toContainText('Booked', { timeout: 20000 });
    expect(inserts).toHaveLength(1);
  });

  test('an approval-required amenity shows "Pending Approval", not "Booked"', async ({ page }) => {
    await setup(page, 'pending');
    await page.locator('[data-testid="confirm-booking-btn"]').click();
    await expect(page.locator('[data-testid="confirm-booking-btn"]')).toContainText('Pending Approval', { timeout: 20000 });
  });

  test('a slot taken by someone else at the same moment shows a clear message and no success', async ({ page }) => {
    await setup(page, 'conflict');
    await page.locator('[data-testid="confirm-booking-btn"]').click();
    await expect(page.locator('[data-testid="booking-error"]')).toContainText(/just taken/i, { timeout: 20000 });
    await expect(page.locator('[data-testid="confirm-booking-btn"]')).not.toContainText('Booked');
  });
});

test.describe('Cancelling (mocked)', () => {
  test('cancel asks for confirmation, then sends exactly one cancel update for THAT reservation', async ({ page }) => {
    await blockHostedWrites(page);
    const d = new Date(); d.setDate(d.getDate() + 5);
    const updates: { url: string; body: any }[] = [];
    await page.route(/\/rest\/v1\/bookings\?/, async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        updates.push({ url: req.url(), body: JSON.parse(req.postData() ?? '{}') });
        return route.fulfill({ status: 204, body: '' });
      }
      if (req.method() !== 'GET') return route.fallback();
      return route.fulfill(json([{ id: 'b-cancel-me', date: key(d), start_time: '15:00:00', end_time: '16:00:00', status: 'confirmed', cancellation_reason: null, cancelled_by: null, court_id: 'c1', courts: { name: 'The Greens Court', hoa_id: 'h' } }]));
    });
    await page.route(/\/rest\/v1\/amenity_rules\?/, (route) => route.fulfill(json([])));
    const dialogs: string[] = [];
    page.on('dialog', async (dlg) => { dialogs.push(dlg.message()); await dlg.accept(); });
    await page.goto('/my-reservations');
    await expect(page.locator('[data-testid="cancel-reservation-btn"]')).toBeVisible({ timeout: 40000 });
    await page.locator('[data-testid="cancel-reservation-btn"]').click();
    await expect.poll(() => updates.length, { timeout: 20000 }).toBe(1);
    expect(dialogs.join(' ')).toContain('Cancel your The Greens Court reservation');
    expect(updates[0].url).toContain('id=eq.b-cancel-me');
    expect(updates[0].body).toEqual({ status: 'cancelled' });
  });

  test('declining the confirmation sends nothing', async ({ page }) => {
    await blockHostedWrites(page);
    const d = new Date(); d.setDate(d.getDate() + 5);
    let patches = 0;
    await page.route(/\/rest\/v1\/bookings\?/, async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') { patches++; return route.fulfill({ status: 204, body: '' }); }
      if (req.method() !== 'GET') return route.fallback();
      return route.fulfill(json([{ id: 'b1', date: key(d), start_time: '15:00:00', end_time: '16:00:00', status: 'confirmed', cancellation_reason: null, cancelled_by: null, court_id: 'c1', courts: { name: 'The Greens Court', hoa_id: 'h' } }]));
    });
    await page.route(/\/rest\/v1\/amenity_rules\?/, (route) => route.fulfill(json([])));
    page.on('dialog', async (dlg) => { await dlg.dismiss(); });
    await page.goto('/my-reservations');
    await expect(page.locator('[data-testid="cancel-reservation-btn"]')).toBeVisible({ timeout: 40000 });
    await page.locator('[data-testid="cancel-reservation-btn"]').click();
    await page.waitForTimeout(1500);
    expect(patches).toBe(0);
  });
});
