import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const DOCS = '/(resident)/docs';

test.describe('Resident Docs Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DOCS);
    await page.waitForLoadState('domcontentloaded');
    // Community mode's Header renders testID="community-wordmark", not
    // "tenisx-logo" (Header.tsx: isCommunityMode branch) — waiting on the
    // wrong one hung every test in this file for the full 60s timeout.
    // docs-heading is docs.tsx's own always-rendered testID, independent of
    // header variant, so anchor on that instead.
    await expect(page.locator('[data-testid="docs-heading"]')).toBeVisible({ timeout: 15000 });
  });

  // ── Header ────────────────────────────────────────────────────────────────

  test('header wordmark is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="community-wordmark"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('bell icon is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible({ timeout: 10000 });
  });

  test('avatar icon is visible', async ({ page }) => {
    // Header.tsx no longer has a "menu-icon" testID at all (in either mode) —
    // avatar-icon replaced the hamburger menu as the rightmost header action
    // (same finding already documented in courts.spec.ts).
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Hero ──────────────────────────────────────────────────────────────────

  test('"Community Documents" heading is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="docs-heading"]')).toBeVisible({ timeout: 10000 });
  });

  test('document count is shown in hero', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-count"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Supabase data ─────────────────────────────────────────────────────────

  test('document count is not "0 documents"', async ({ page }) => {
    // Wait for data to load — either doc cards or empty state
    await expect(
      page.locator('[data-testid="doc-card"]').first()
        .or(page.locator('[data-testid="docs-empty"]'))
    ).toBeVisible({ timeout: 30000 });
    // The count should show a non-zero number
    const countEl = page.locator('[data-testid="doc-count"]');
    await expect(countEl).not.toHaveText('0 documents', { timeout: 5000 });
  });

  test('"No documents" state is NOT visible when HOA has docs', async ({ page }) => {
    // Wait for data
    await expect(
      page.locator('[data-testid="doc-card"]').first()
        .or(page.locator('[data-testid="docs-empty"]'))
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="docs-empty"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('at least one document card renders from Supabase', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
  });

  // ── Categories ────────────────────────────────────────────────────────────

  test('documents are grouped in at least one category section', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="category-section"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('category section has a header label', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="category-label"]').first()).toBeVisible({ timeout: 5000 });
  });

  // ── Search ────────────────────────────────────────────────────────────────

  test('search bar is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('search filters documents in real time', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="search-input"]').fill('zzznomatch_____xyz');
    await expect(page.locator('[data-testid="docs-empty"]')).toBeVisible({ timeout: 8000 });
  });

  test('clearing search restores documents', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-testid="search-input"]').fill('zzznomatch_____xyz');
    await expect(page.locator('[data-testid="docs-empty"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="search-input"]').clear();
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 8000 });
  });

  // ── Document buttons ──────────────────────────────────────────────────────

  test('each document card has a view (eye) button', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doc-eye-btn"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('each document card has a download button', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="doc-download-btn"]').first()).toBeVisible({ timeout: 5000 });
  });

  // ── Storage access (private bucket → signed URLs) ─────────────────────────
  // Root cause of the reported "404 Bucket not found": file_url stores a *public* object
  // URL but the hoa-documents bucket is private. View/Download now sign the path.

  test('View opens a signed, authorized URL — never the public bucket URL', async ({ page, context }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    // window.open(..., 'noopener') leaves popup.url() empty until navigation completes, so
    // read the URL from the popup's first GET instead.
    const popupPromise = context.waitForEvent('page');
    const signedRequestPromise = context.waitForEvent('request', {
      predicate: (r: import('@playwright/test').Request) =>
        r.method() === 'GET' && /\/object\/sign\/hoa-documents\//.test(r.url()),
      timeout: 20000,
    });
    await page.locator('[data-testid="doc-eye-btn"]').first().click();
    const popup = await popupPromise;
    const url = (await signedRequestPromise).url();
    expect(url).toMatch(/\/storage\/v1\/object\/sign\/hoa-documents\/.+token=/);
    expect(url).not.toMatch(/object\/public/);
    const res = await page.request.get(url);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect((await res.body()).subarray(0, 4).toString()).toBe('%PDF');
    await popup.close();
  });

  test('Download delivers the actual PDF', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('[data-testid="doc-download-btn"]').first().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const file = await download.path();
    const bytes = fs.readFileSync(file!);
    expect(bytes.length).toBeGreaterThan(10000);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });

  for (const [label, handler, expected] of [
    ['missing file', (r: any) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }) }), /Document unavailable/],
    ['unauthorized', (r: any) => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }) }), /Access denied/],
    ['expired session', (r: any) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: '400', error: 'InvalidJWT', message: 'jwt expired' }) }), /Session expired/],
    ['offline', (r: any) => r.abort('failed'), /Connection problem/],
  ] as const) {
    test(`failure state — ${label} — shows a readable message, not raw storage errors`, async ({ page }) => {
      await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
      await page.route('**/storage/v1/object/sign/**', handler as any);
      await page.locator('[data-testid="doc-eye-btn"]').first().click();
      const notice = page.locator('[data-testid="doc-notice"]');
      await expect(notice).toBeVisible({ timeout: 15000 });
      await expect(notice).toContainText(expected);
      await expect(notice).not.toContainText(/NoSuchBucket|Bucket not found|404/);
    });
  }

  test('document UI uses vector icons — no emoji', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    const text = await page.locator('[data-testid="doc-card"]').first().innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test('category filter chips narrow the list', async ({ page }) => {
    await expect(page.locator('[data-testid="doc-card"]').first()).toBeVisible({ timeout: 30000 });
    const chips = page.locator('[data-testid^="category-chip-"]');
    if ((await chips.count()) > 2) {
      const total = await page.locator('[data-testid="doc-card"]').count();
      await chips.nth(1).click();
      const filtered = await page.locator('[data-testid="doc-card"]').count();
      expect(filtered).toBeLessThan(total);
      await page.locator('[data-testid="category-chip-all"]').click();
      expect(await page.locator('[data-testid="doc-card"]').count()).toBe(total);
    }
  });
});
