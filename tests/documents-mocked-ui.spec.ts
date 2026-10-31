import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Documents & PDFs in a real browser against a MOCKED backend: the document list, the signed-link request and the PDF itself are
 * all answered locally; hosted writes are blocked. Proves the UI journey (list, categories, open a PDF through a short-lived
 * signed link, empty / error / inaccessible states). It does not prove the live storage policy.
 */
const HOA = 'hoa-mock';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const doc = (id: string, title: string, category: string, file: string) => ({
  id, hoa_id: HOA, title, category, file_name: file, size: null, file_size_bytes: 120000,
  file_url: `https://x.supabase.co/storage/v1/object/public/hoa-documents/${HOA}/${category}/${file}`,
  created_at: '2026-09-01T12:00:00Z',
});

const SIGN = /\/storage\/v1\/object\/sign\/hoa-documents\//;
const SIGNED_PDF = /\/object\/sign\/hoa-documents\/.*token=mock-token/;

async function open(page: Page, rows: unknown[] | 'error') {
  await blockHostedWrites(page);
  await page.route(/\/rest\/v1\/hoa_documents\?/, (route) =>
    route.request().method() !== 'GET' ? route.fallback()
      : rows === 'error' ? route.fulfill(json({ message: 'boom' }, 500)) : route.fulfill(json(rows)));
  await page.goto('/docs');
}

test.describe('Documents (mocked)', () => {
  test('lists documents grouped by category with a count, and filters by search', async ({ page }) => {
    await open(page, [
      doc('d1', 'Community Bylaws', 'rules_bylaws', 'bylaws.pdf'),
      doc('d2', 'October Board Minutes', 'meeting_minutes', 'minutes.pdf'),
      doc('d3', 'Budget 2026', 'financial_statements', 'budget.pdf'),
    ]);
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doc-card"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="doc-count"]')).toContainText('3');
    expect(await page.locator('[data-testid="category-section"]').count()).toBeGreaterThanOrEqual(3);
    await page.locator('[data-testid="search-input"]').fill('minutes');
    await expect(page.locator('[data-testid="doc-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="doc-card"]')).toContainText('October Board Minutes');
  });

  test('View opens the PDF through a short-lived SIGNED link (never the raw public URL)', async ({ page, context }) => {
    let signedFor = '';
    let pdfRequested = '';
    await context.route(SIGNED_PDF, (route) => {
      pdfRequested = route.request().url();
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' });
    });
    await open(page, [doc('d1', 'Community Bylaws', 'rules_bylaws', 'bylaws.pdf')]);
    // registered AFTER the write guard, so it takes priority over the guard's canned storage answer
    await page.route(SIGN, async (route) => {
      signedFor = decodeURIComponent(new URL(route.request().url()).pathname);
      await route.fulfill(json({ signedURL: `/object/sign/hoa-documents/${HOA}/rules_bylaws/bylaws.pdf?token=mock-token` }));
    });
    await expect(page.locator('[data-testid="doc-card"]')).toBeVisible({ timeout: 30000 });
    await Promise.all([page.waitForEvent('popup', { timeout: 20000 }), page.locator('[data-testid="doc-eye-btn"]').click()]);
    expect(signedFor).toContain(`${HOA}/rules_bylaws/bylaws.pdf`);
    // headless Chromium turns a PDF response into a download, so assert on the request the new window made
    await expect.poll(() => pdfRequested, { timeout: 20000 }).toContain('token=mock-token');
    expect(pdfRequested).not.toContain('/object/public/');
  });

  test('a document the resident cannot open shows a clear message instead of failing silently', async ({ page }) => {
    await open(page, [doc('d1', 'Community Bylaws', 'rules_bylaws', 'bylaws.pdf')]);
    await page.route(SIGN, (route) =>
      route.fulfill(json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400)));
    await expect(page.locator('[data-testid="doc-card"]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="doc-eye-btn"]').click();
    await expect(page.locator('[data-testid="doc-notice"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="doc-notice"]')).toContainText('Community Bylaws');
  });

  test('empty community: a clear empty state, not a blank screen', async ({ page }) => {
    await open(page, []);
    await expect(page.locator('[data-testid="docs-empty"]')).toBeVisible({ timeout: 30000 });
  });

  test('a failed load shows an error state (with retry), never an empty list', async ({ page }) => {
    await open(page, 'error');
    await expect(page.locator('[data-testid="docs-error"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="docs-empty"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="doc-card"]')).toHaveCount(0);
  });
});
