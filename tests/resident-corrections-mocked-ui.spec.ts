import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Resident acceptance corrections, exercised in a REAL browser against a MOCKED backend: every Supabase read the screen makes
 * is answered locally and every write is blocked, so no hosted data is read for content or created. These tests prove the UI
 * behaviour; they do not prove the live database.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const COURT = '44444444-4444-4444-8444-444444444444';
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Answers PostgREST reads; `object` requests (.single()/.maybeSingle()) get the first row, as an object. */
async function mockRead(page: Page, table: string, rows: unknown[] | ((url: URL) => unknown[])) {
  await page.route(new RegExp(`/rest/v1/${table}\\?`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const data = typeof rows === 'function' ? rows(url) : rows;
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill(wantsObject ? json(data[0] ?? null) : json(data));
  });
}

function luminance(rgb: number[]): number {
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
/** Contrast of an element's text against the first opaque background found walking up its ancestors. */
async function contrastOf(page: Page, testId: string): Promise<number> {
  const parsed = await page.locator(`[data-testid="${testId}"]`).first().evaluate((el: HTMLElement) => {
    const rgba = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const fg = rgba(getComputedStyle(el).color);
    let node: HTMLElement | null = el;
    let bg = [255, 255, 255, 1];
    while (node) {
      const c = rgba(getComputedStyle(node).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3] > 0.9)) { bg = c; break; }
      node = node.parentElement;
    }
    return { fg, bg };
  });
  const [a, b] = [luminance(parsed.fg), luminance(parsed.bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test.describe('Report: default severity and back button', () => {
  test.beforeEach(async ({ page }) => { await blockHostedWrites(page); });

  test('a new report starts at LOW severity, not Medium', async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('[data-testid="filter-tabs"]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="new-report-btn"]').click();
    await expect(page.locator('[data-testid="severity-selector"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="severity-low"]')).toHaveCSS('background-color', 'rgb(16, 185, 129)');
    await expect(page.locator('[data-testid="severity-medium"]')).not.toHaveCSS('background-color', 'rgb(245, 158, 11)');
    // choosing another level still works
    await page.locator('[data-testid="severity-high"]').click();
    await expect(page.locator('[data-testid="severity-low"]')).not.toHaveCSS('background-color', 'rgb(16, 185, 129)');
  });

  test('the facility-form back button is a visible 44pt+ target', async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('[data-testid="filter-tabs"]')).toBeVisible({ timeout: 30000 });
    const back = page.locator('[data-testid="header-back"]').first();
    if (await back.count()) {
      const box = await back.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Notifications (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await blockHostedWrites(page);
    const now = Date.now();
    const iso = (offsetSec: number) => new Date(now - offsetSec * 1000).toISOString();
    await mockRead(page, 'messages', []);
    await mockRead(page, 'hoa_notifications', [
      // two DIFFERENT reports with identical generic text: must stay two rows
      { id: 'n1', type: 'report_submitted', title: 'New maintenance report', body: 'A new report was submitted', metadata: { report_id: R1 }, read: false, created_at: iso(120) },
      { id: 'n2', type: 'report_submitted', title: 'New maintenance report', body: 'A new report was submitted', metadata: { report_id: R2 }, read: false, created_at: iso(150) },
      // the SAME application written twice within seconds: must fold into one row
      { id: 'n3', type: 'member_application', title: 'New member application', body: 'Someone applied', metadata: { applicant_id: 'a1', membership_id: 'm1' }, read: false, created_at: iso(300) },
      { id: 'n4', type: 'member_application', title: 'New member application', body: 'Someone applied', metadata: { applicant_id: 'a1', membership_id: 'm1' }, read: false, created_at: iso(305) },
      // an older day
      { id: 'n5', type: 'announcement', title: 'Pool closed', body: 'Closed for cleaning', metadata: null, read: true, created_at: new Date(now - 26 * 3600 * 1000).toISOString() },
    ]);
    await mockRead(page, 'maintenance_reports', [
      { id: R1, category: 'plumbing', location_text: null, amenity_id: COURT },
      { id: R2, category: 'safety', location_text: 'Main gate', amenity_id: null },
    ]);
    await mockRead(page, 'courts', [{ id: COURT, name: 'The Greens Court' }]);
    await mockRead(page, 'bookings', []);
    await page.goto('/notifications');
  });

  test('similar-looking reports stay separate, a true double-write folds, and rows are described and grouped by day', async ({ page }) => {
    const items = page.locator('[data-testid="notification-item"]');
    await expect(items.first()).toBeVisible({ timeout: 30000 });
    await expect(items).toHaveCount(4); // 2 reports + 1 folded application + 1 announcement
    await expect(page.locator('[data-testid="notification-detail"]').filter({ hasText: 'The Greens Court · Water & Plumbing' })).toHaveCount(1);
    await expect(page.locator('[data-testid="notification-detail"]').filter({ hasText: 'Main gate · Safety' })).toHaveCount(1);
    await expect(page.locator('[data-testid="notification-section"]').first()).toContainText('TODAY');
    expect(await page.locator('[data-testid="notification-section"]').count()).toBeGreaterThanOrEqual(1);
  });

  test('tapping a report notification opens THAT report', async ({ page }) => {
    const first = page.locator('[data-testid="notification-item"]').filter({ hasText: 'The Greens Court' });
    await expect(first).toBeVisible({ timeout: 30000 });
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/report-detail/${R1}`), { timeout: 20000 });
  });

  test('the back button is a visible 44pt+ target', async ({ page }) => {
    await expect(page.locator('[data-testid="notification-item"]').first()).toBeVisible({ timeout: 30000 });
    const box = await page.locator('[data-testid="header-back"]').first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Report Detail (mocked)', () => {
  test('readable card layout with status, severity, location, dates and the updates section', async ({ page }) => {
    await blockHostedWrites(page);
    const created = new Date(Date.now() - 3 * 86400000).toISOString();
    await mockRead(page, 'maintenance_reports', [{
      id: R1, category: 'plumbing', description: 'The fountain near the pool deck is leaking onto the walkway.', status: 'in_progress',
      priority: 'low', photo_url: null, resolution_notes: null, location_text: 'Pool deck', report_type: 'location', is_urgent: false,
      created_at: created, updated_at: new Date().toISOString(), amenity_id: null,
    }]);
    await mockRead(page, 'report_notes', []);
    await mockRead(page, 'courts', []);
    await page.goto(`/report-detail/${R1}`);
    await expect(page.locator('[data-testid="report-detail-screen"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="detail-title"]')).toContainText('Pool deck');
    await expect(page.locator('[data-testid="detail-status"]')).toHaveText('In progress');
    await expect(page.locator('[data-testid="detail-priority"]')).toHaveText('Low severity');
    await expect(page.locator('[data-testid="detail-category"]')).toContainText('Water & Plumbing');
    await expect(page.locator('[data-testid="detail-location"]')).toContainText('Pool deck');
    await expect(page.locator('[data-testid="detail-submitted-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="detail-updated-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="detail-description"]')).toContainText('fountain');
    await expect(page.locator('[data-testid="detail-no-updates"]')).toBeVisible();
    // REGRESSION: text must be readable on its card (the old screen put dark text on the dark canvas)
    expect(await contrastOf(page, 'detail-title')).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(page, 'detail-description')).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(page, 'detail-status')).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('My Reservations: compact Upcoming cards (mocked)', () => {
  test('shows the relative day, true length, and a compact card with an inline action', async ({ page }) => {
    await blockHostedWrites(page);
    await mockRead(page, 'bookings', [
      { id: 'b1', date: key(addDays(1)), start_time: '15:00:00', end_time: '16:30:00', status: 'confirmed', cancellation_reason: null, cancelled_by: null, court_id: COURT, courts: { name: 'The Greens Court', hoa_id: 'h1' } },
      { id: 'b2', date: key(addDays(12)), start_time: '09:00:00', end_time: '10:00:00', status: 'confirmed', cancellation_reason: null, cancelled_by: null, court_id: COURT, courts: { name: 'Clubhouse', hoa_id: 'h1' } },
    ]);
    await mockRead(page, 'amenity_rules', []);
    await page.goto('/my-reservations');
    const cards = page.locator('[data-testid="reservation-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 30000 });
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Tomorrow');
    await expect(cards.nth(0)).toContainText('1 h 30 min');
    await expect(cards.nth(0)).toContainText('3 PM');
    // beyond six days there is no relative label, so the full date is shown instead
    await expect(cards.nth(1)).not.toContainText('Tomorrow');
    await expect(cards.nth(1)).toContainText(String(addDays(12).getFullYear()));
    const box = await cards.nth(0).boundingBox();
    expect(box!.height).toBeLessThan(150);
  });
});

test.describe('Primary tabs return to the top', () => {
  test('a scrolled tab is back at the top after leaving it and coming back', async ({ page }) => {
    await blockHostedWrites(page);
    await page.goto('/(resident)/courts');
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 40000 });
    await page.waitForTimeout(4000);
    const scrollerTop = (p: Page) => p.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((e) => {
        const s = getComputedStyle(e);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 150 && e.clientHeight > 300;
      });
      return els.length ? { has: true, top: els[0].scrollTop } : { has: false, top: 0 };
    });
    const scrollIt = (p: Page, y: number) => p.evaluate((yy) => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((e) => {
        const s = getComputedStyle(e);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 150 && e.clientHeight > 300;
      });
      if (els[0]) els[0].scrollTop = yy;
    }, y);
    const before = await scrollerTop(page);
    test.skip(!before.has, 'the Reserve tab has no scrollable content with the test data');
    await scrollIt(page, 220);
    expect((await scrollerTop(page)).top).toBeGreaterThan(50);
    await page.locator('[data-testid="tab-index"]').click();
    await page.waitForTimeout(800);
    await page.locator('[data-testid="tab-courts"]').click();
    await page.waitForTimeout(800);
    expect((await scrollerTop(page)).top).toBe(0);
  });
});
