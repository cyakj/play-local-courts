/**
 * My Reservations + reservation detail. Read-only: nothing is booked or cancelled.
 * (Approval/cancellation rules themselves are verified in supabase/tests/booking_approval.sql
 * and tests/reservations-logic.spec.ts.)
 */
import { test, expect } from '@playwright/test';

test.describe('My Reservations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-reservations');
    await expect(page.getByText('My Reservations', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  });

  test('inner header carries both TenisX and the active community identity', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="community-wordmark"]').first()).toBeVisible({ timeout: 20000 });
  });

  test('reservation cards open a details screen with status, date, time and policy', async ({ page }) => {
    const card = page.locator('[data-testid="reservation-card"]').first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.click();
    await expect(page.locator('[data-testid="reservation-court"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="reservation-status-description"]')).toBeVisible();
    await expect(page.getByText('Approval', { exact: true })).toBeVisible();
    await expect(page.getByText(/Cancellation policy:/)).toBeVisible();
  });

  test('statuses use plain labels (no raw lowercase enum text)', async ({ page }) => {
    const card = page.locator('[data-testid="reservation-card"]').first();
    await expect(card).toBeVisible({ timeout: 30000 });
    const text = await card.innerText();
    expect(text).toMatch(/Pending approval|Confirmed|Declined|Cancelled/);
    expect(text).not.toMatch(/\b(pending|confirmed|rejected|cancelled)\b/);
  });

  test('a blocked cancellation explains why instead of showing a cryptic "<24h" chip', async ({ page }) => {
    await expect(page.locator('[data-testid="reservation-card"]').first()).toBeVisible({ timeout: 30000 });
    expect(await page.getByText(/^<\d+h$/).count()).toBe(0);
    for (const el of await page.locator('[data-testid="cancel-unavailable"]').all()) {
      // The chip shows the SHORT reason ("Closed 24h before start" / "Started"); the full sentence is its accessible label.
      const spoken = `${(await el.getAttribute('aria-label')) ?? ''} ${await el.innerText()}`;
      expect(spoken).toMatch(/Cancellations close \d+ hours? before the start time|already started/);
      expect(await el.innerText()).toMatch(/Closed \d+h before start|Started/);
    }
  });

  test('unknown reservation id shows a not-found state', async ({ page }) => {
    await page.goto('/reservation-detail/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('[data-testid="reservation-not-found"]')).toBeVisible({ timeout: 30000 });
  });
});
