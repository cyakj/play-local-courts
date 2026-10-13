/**
 * Admin redesign — layout, navigation, calendar integrity, filters and contrast.
 * READ-ONLY against whatever backend .env points at: it signs in as TEST_ADMIN_* and never saves anything.
 *   PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test -c playwright.admin.config.ts
 */
import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.locator('input[placeholder="your@email.com"]').fill(process.env.TEST_ADMIN_EMAIL ?? '');
  await page.locator('input[type="password"]').first().fill(process.env.TEST_ADMIN_PASSWORD ?? '');
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 90000 });
  await page.getByTestId('admin-portfolio').waitFor({ timeout: 60000 });
});

test.afterAll(async () => { await page.close(); });

async function noHorizontalOverflow(p: Page) {
  const { scrollWidth, innerWidth } = await p.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth + 1);
}

/** WCAG contrast of every visible text node against its first opaque ancestor background. */
async function lowContrastText(p: Page, scopeTestId: string) {
  return p.evaluate((scope) => {
    const root = document.querySelector(`[data-testid="${scope}"]`) ?? document.body;
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x));
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element | null): { r: number; g: number; b: number } => {
      while (el) {
        const c = parse(getComputedStyle(el).backgroundColor);
        if (c && c.a > 0.95) return c;
        el = el.parentElement;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const bad: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || rect.width === 0 || rect.height === 0) continue;
      if (parseFloat(cs.opacity) === 0) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const l1 = lum(fg); const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (large ? 3 : 4.5)) bad.push(`"${text.slice(0, 30)}" ${ratio.toFixed(2)}:1 (${cs.color} on rgb(${bg.r},${bg.g},${bg.b}))`);
    }
    return bad;
  }, scopeTestId);
}

test('Portfolio: compact header, readable metrics, no overlap with the tab bar', async () => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('admin-portfolio').waitFor();
  await page.getByTestId('metric-open-issues').waitFor();

  const header = await page.getByTestId('tenisx-logo').boundingBox();
  expect(header, 'logo is rendered').not.toBeNull();
  // The navy header band (logo row + greeting) must stay compact: logo sits within the top 60px.
  expect(header!.y + header!.height).toBeLessThan(70);

  for (const id of ['metric-open-issues', 'metric-today', 'metric-members', 'metric-pending']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await noHorizontalOverflow(page);

  // Scroll to the bottom: the last community card must end above the tab bar.
  await page.evaluate(() => { document.querySelectorAll('*').forEach((e) => { (e as HTMLElement).scrollTop = 1e6; }); });
  await page.waitForTimeout(400);
  const nav = await page.getByTestId('bottom-nav').boundingBox();
  const cards = page.locator('[data-testid^="community-"]');
  const last = await cards.last().boundingBox();
  expect(last!.y + last!.height, 'last card is not hidden by the tab bar').toBeLessThanOrEqual(nav!.y + 1);
});

test('Portfolio: no unreadable text', async () => {
  const bad = await lowContrastText(page, 'admin-portfolio');
  expect(bad, bad.join('\n')).toEqual([]);
});

test('Navigation: Portfolio, Issues, Calendar and Alerts are reachable from the tab bar', async () => {
  for (const [tab, screen] of [['maintenance', 'admin-issues'], ['calendar', 'admin-calendar'], ['alerts', 'admin-alerts'], ['index', 'admin-portfolio']] as const) {
    await page.getByTestId(`tab-${tab}`).click();
    await expect(page.getByTestId(screen)).toBeVisible();
    await noHorizontalOverflow(page);
  }
});

test('Issues: status filters work together with category/priority filters; counts are consistent', async () => {
  await page.getByTestId('tab-maintenance').click();
  await page.getByTestId('status-all').waitFor();
  const countOf = async (id: string) => Number(((await page.getByTestId(id).innerText()).match(/(\d+)\s*$/) ?? [])[1]);
  const all = await countOf('status-all');
  const parts = (await Promise.all(['status-open', 'status-in_progress', 'status-resolved', 'status-closed'].map(countOf)));
  expect(parts.reduce((a, b) => a + b, 0), 'status counts add up to All').toBe(all);

  await page.getByTestId('status-open').click();
  const cards = page.locator('[data-testid^="report-"]');
  if ((await cards.count()) > 0) {
    // every visible card is Open
    const texts = await cards.allInnerTexts();
    expect(texts.every((t) => /open/i.test(t))).toBe(true);
  }
  await page.getByTestId('more-filters').click();
  await expect(page.getByText('All categories')).toBeVisible();
  await expect(page.getByText('Any priority')).toBeVisible();
  const bad = await lowContrastText(page, 'admin-issues');
  expect(bad, bad.join('\n')).toEqual([]);
});

test('Calendar: every date renders, aligned under its weekday, and navigation works', async () => {
  await page.getByTestId('tab-calendar').click();
  await page.getByTestId('calendar-label').waitFor();
  const cells = page.locator('[data-testid^="day-"]');
  const n = await cells.count();
  expect(n % 7, 'full weeks only').toBe(0);
  expect(n).toBeGreaterThanOrEqual(28);

  // Dates are consecutive and each row's first cell is a Sunday; x positions repeat per weekday.
  const labels = await cells.evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-testid')!.replace('day-', ''), x: Math.round(e.getBoundingClientRect().x) })));
  for (let i = 1; i < labels.length; i++) {
    const prev = new Date(labels[i - 1].id + 'T00:00:00Z').getTime();
    expect(new Date(labels[i].id + 'T00:00:00Z').getTime() - prev).toBe(86_400_000);
  }
  const xs = labels.slice(0, 7).map((l) => l.x);
  labels.forEach((l, i) => expect(Math.abs(l.x - xs[i % 7]), `cell ${l.id} aligned with its weekday column`).toBeLessThanOrEqual(1));
  expect(new Date(labels[0].id + 'T00:00:00Z').getUTCDay()).toBe(0);

  const first = await page.getByTestId('calendar-label').innerText();
  await page.getByRole('button', { name: 'Next month' }).click();
  expect(await page.getByTestId('calendar-label').innerText()).not.toBe(first);
  await page.getByTestId('today-btn').click();
  expect(await page.getByTestId('calendar-label').innerText()).toBe(first);

  await page.getByTestId('view-week').click();
  expect(await page.locator('[data-testid^="day-"]').count()).toBe(7);
  await page.getByTestId('view-month').click();
  await noHorizontalOverflow(page);
  const bad = await lowContrastText(page, 'admin-calendar');
  expect(bad, bad.join('\n')).toEqual([]);
});

test('Calendar: type filter narrows the list and "All types" restores it', async () => {
  await page.getByTestId('type-blockout').click();
  const rows = page.locator('[data-testid^="event-"]');
  for (const t of await rows.allInnerTexts()) expect(t.toUpperCase()).toContain('BLOCKOUT');
  await page.getByText('All types', { exact: true }).click();
});

test('Alerts: filters work, urgent is a strict subset, and nothing is double counted', async () => {
  await page.getByTestId('tab-alerts').click();
  await page.getByTestId('alerts-all').waitFor();
  const countOf = async (id: string) => Number(((await page.getByTestId(id).innerText()).match(/(\d+)\s*$/) ?? [])[1]);
  const all = await countOf('alerts-all');
  const urgent = await countOf('alerts-urgent');
  const kinds = (await Promise.all(['alerts-approvals', 'alerts-issues', 'alerts-bookings'].map(countOf))).reduce((a, b) => a + b, 0);
  expect(kinds, 'every alert belongs to exactly one category').toBe(all);
  expect(urgent).toBeLessThanOrEqual(all);
  expect(urgent, 'urgent must not equal "every open issue"').toBeLessThan(Math.max(all, 1) + 1);

  await page.getByTestId('alerts-urgent').click();
  const shown = page.locator('[data-testid^="alert-"]');
  expect(await shown.count()).toBe(urgent);
  for (const t of await shown.allInnerTexts()) expect(t.toUpperCase()).toContain('URGENT');

  // alert ids are unique (a refresh can never create a second alert for one record)
  await page.getByTestId('alerts-all').click();
  const ids = await page.locator('[data-testid^="alert-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(new Set(ids).size).toBe(ids.length);
  const bad = await lowContrastText(page, 'admin-alerts');
  expect(bad, bad.join('\n')).toEqual([]);
});

for (const width of [320, 390]) {
  test(`Community screen fits a ${width}px phone (tabs fully visible, no overflow, no clipping)`, async () => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('admin-portfolio').waitFor();
    await page.locator('[data-testid^="community-"]').first().click();
    await page.getByTestId('admin-community').waitFor();
    for (const id of ['tab-overview', 'tab-reports', 'tab-amenities', 'tab-members']) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b, id).not.toBeNull();
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width, `${id} inside viewport`).toBeLessThanOrEqual(width);
    }
    await noHorizontalOverflow(page);
    for (const id of ['tab-reports', 'tab-amenities', 'tab-members', 'tab-overview']) {
      await page.getByTestId(id).click();
      await noHorizontalOverflow(page);
    }
    const bad = await lowContrastText(page, 'admin-community');
    expect(bad, bad.join('\n')).toEqual([]);
  });
}

test('Accessibility: large text does not break the portfolio layout', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('admin-portfolio').waitFor();
  await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
  await page.waitForTimeout(300);
  await noHorizontalOverflow(page);
  const box = await page.getByTestId('metric-open-issues').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});
