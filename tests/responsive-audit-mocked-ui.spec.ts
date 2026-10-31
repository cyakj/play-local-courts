import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Responsive audit of the Resident screens at several phone/tablet sizes. Hosted writes are blocked (reads only). Per screen
 * and size it checks, in a real browser:
 *   - no horizontal page overflow (nothing wider than the viewport)
 *   - header controls (back, bell, avatar) are at least 44x44 and fully inside the viewport
 *   - the bottom navigation, where the screen has one, is visible and inside the viewport
 *   - no text element is clipped by being wider than its visible container's right edge
 */
const SIZES = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 8', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone Pro Max', width: 430, height: 932 },
  { name: 'iPad', width: 768, height: 1024 },
];

const R1 = '11111111-1111-4111-8111-111111111111';
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockRead(page: Page, table: string, rows: unknown[]) {
  await page.route(new RegExp(`/rest/v1/${table}\\?`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill(wantsObject ? json(rows[0] ?? null) : json(rows));
  });
}

interface Screen { name: string; path: string; tabbed: boolean; mock?: (p: Page) => Promise<void>; ready: string; controls: string[] }
const SCREENS: Screen[] = [
  { name: 'Home', controls: ['bell-icon', 'avatar-icon'], path: '/(resident)', tabbed: true, ready: '[data-testid="bottom-nav"]' },
  { name: 'Reserve', controls: ['bell-icon', 'avatar-icon'], path: '/(resident)/courts', tabbed: true, ready: '[data-testid="bottom-nav"]' },
  { name: 'Schedule', controls: ['bell-icon', 'avatar-icon'], path: '/(resident)/calendar', tabbed: true, ready: '[data-testid="bottom-nav"]' },
  { name: 'Community', controls: ['bell-icon', 'avatar-icon'], path: '/(resident)/community', tabbed: true, ready: '[data-testid="bottom-nav"]' },
  { name: 'Me', controls: ['bell-icon', 'avatar-icon'], path: '/(resident)/me', tabbed: true, ready: '[data-testid="bottom-nav"]' },
  { name: 'Report', controls: ['header-back', 'bell-icon', 'avatar-icon'], path: '/report', tabbed: false, ready: '[data-testid="filter-tabs"]' },
  { name: 'Notifications', controls: ['header-back'], path: '/notifications', tabbed: false, ready: '[data-testid="notification-item"]', mock: async (p) => {
    await mockRead(p, 'messages', []);
    await mockRead(p, 'hoa_notifications', [
      { id: 'n1', type: 'report_status_changed', title: 'Your report was updated with a rather long title that must wrap', body: 'Status is now in progress and a long explanation follows here so the body wraps over lines', metadata: { report_id: R1 }, read: false, created_at: new Date().toISOString() },
    ]);
    await mockRead(p, 'maintenance_reports', [{ id: R1, category: 'grounds_landscaping', location_text: 'The north pool deck by the clubhouse entrance', amenity_id: null }]);
  } },
  { name: 'Report detail', controls: ['header-back'], path: `/report-detail/${R1}`, tabbed: false, ready: '[data-testid="report-detail-screen"] [data-testid="detail-title"]', mock: async (p) => {
    await mockRead(p, 'maintenance_reports', [{
      id: R1, category: 'grounds_landscaping', description: 'A long description '.repeat(12), status: 'in_progress', priority: 'high',
      photo_url: null, resolution_notes: null, location_text: 'The north pool deck by the clubhouse entrance', report_type: 'location', is_urgent: true,
      created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString(), amenity_id: null,
    }]);
    await mockRead(p, 'report_notes', []);
    await mockRead(p, 'courts', []);
  } },
  { name: 'My Reservations', controls: ['header-back'], path: '/my-reservations', tabbed: false, ready: '[data-testid="reservation-card"]', mock: async (p) => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await mockRead(p, 'bookings', [{ id: 'b1', date, start_time: '15:00:00', end_time: '16:30:00', status: 'pending', cancellation_reason: null, cancelled_by: null, court_id: 'c1', courts: { name: 'The Greens Tennis Court Number One', hoa_id: 'h' } }]);
    await mockRead(p, 'amenity_rules', []);
  } },
];

async function audit(page: Page, size: { width: number; height: number }, tabbed: boolean, controls: string[]) {
  return page.evaluate(({ w, h, tabbed, controls }) => {
    const problems: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > w + 1) problems.push(`page is ${de.scrollWidth}px wide in a ${w}px viewport`);
    for (const id of controls) {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) { problems.push(`${id} is missing on this screen`); continue; }
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) problems.push(`${id} is ${Math.round(r.width)}x${Math.round(r.height)} (<44)`);
      if (r.left < -0.5 || r.right > w + 0.5) problems.push(`${id} is outside the viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    if (tabbed) {
      const nav = document.querySelector<HTMLElement>('[data-testid="bottom-nav"]');
      if (!nav) problems.push('bottom nav missing');
      else { const r = nav.getBoundingClientRect(); if (r.bottom > h + 1 || r.width > w + 1) problems.push('bottom nav not inside the viewport'); }
    }
    // text clipped past the right edge of the viewport
    const clipped = Array.from(document.querySelectorAll<HTMLElement>('div,span')).filter((e) => {
      if (!e.childNodes.length || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())) return false;
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.right > w + 2)) return false;
      // chips inside an intentionally horizontal scroller (e.g. the Schedule filter chips) may extend past the edge
      for (let a: HTMLElement | null = e.parentElement; a; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth) return false;
      }
      return true;
    });
    // text cut off INSIDE its own box (overflow hidden with content wider than the box)
    const cut = Array.from(document.querySelectorAll<HTMLElement>('div,span')).filter((e) => {
      if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())) return false;
      const st = getComputedStyle(e);
      if (st.overflowX !== 'hidden' || st.textOverflow === 'ellipsis') return false; // ellipsised single-line text is deliberate
      return e.scrollWidth > e.clientWidth + 2;
    });
    if (cut.length) problems.push(`${cut.length} text element(s) are cut off inside their box, e.g. "${(cut[0].textContent ?? '').trim().slice(0, 40)}"`);
    if (clipped.length) problems.push(`${clipped.length} text element(s) extend past the right edge, e.g. "${(clipped[0].textContent ?? '').trim().slice(0, 40)}"`);
    return problems;
  }, { w: size.width, h: size.height, tabbed, controls });
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const screen of SCREENS) {
      test(`${screen.name}: no overflow, 44pt header targets, nav inside the viewport`, async ({ page }) => {
        test.setTimeout(120000);
        await blockHostedWrites(page);
        await screen.mock?.(page);
        await page.goto(screen.path);
        await expect(page.locator(screen.ready).first()).toBeVisible({ timeout: 60000 });
        await page.waitForTimeout(1500);
        const problems = await audit(page, size, screen.tabbed, screen.controls);
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  });
}
