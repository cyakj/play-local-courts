/**
 * Browser-level regression test: coach realtime subscription crash.
 *
 * Verifies that navigating away from and back to the coach schedule tab does
 * NOT produce the Supabase error:
 *   "cannot add postgres_changes callbacks for realtime:<channel> after subscribe()"
 *
 * Root cause of the bug: a fixed channel name (e.g. 'coach-requests-realtime')
 * means the channel registered during the first mount is still in Supabase's
 * internal registry when the component remounts, because removeChannel() is async.
 * Fix: use Date.now() to create a unique channel name per subscription.
 *
 * Run: npx playwright test tests/coach-realtime.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';

test.describe('Coach realtime subscription — no channel name collision', () => {
  test('navigating to coach schedule does not crash the realtime channel', async ({ page }) => {
    const realtimeErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('cannot add') && text.includes('postgres_changes') && text.includes('after subscribe')) {
          realtimeErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      const msg = err.message;
      if (msg.includes('cannot add') && msg.includes('postgres_changes') && msg.includes('after subscribe')) {
        realtimeErrors.push(msg);
      }
    });

    // First visit — component mounts, subscription created
    await page.goto('/(coach)/schedule');
    await page.waitForLoadState('domcontentloaded');
    // Allow realtime effects to settle
    await page.waitForTimeout(1500);

    // Navigate away (triggers cleanup / removeChannel)
    await page.goto('/(resident)/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Navigate back — triggers remount; this is where the crash happened before the fix
    await page.goto('/(coach)/schedule');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    expect(realtimeErrors, `Realtime crash detected: ${realtimeErrors.join(' | ')}`).toHaveLength(0);
  });

  test('coach dashboard tab does not crash on remount', async ({ page }) => {
    const realtimeErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('cannot add') && text.includes('postgres_changes') && text.includes('after subscribe')) {
          realtimeErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      const msg = err.message;
      if (msg.includes('cannot add') && msg.includes('postgres_changes') && msg.includes('after subscribe')) {
        realtimeErrors.push(msg);
      }
    });

    await page.goto('/(coach)/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.goto('/(resident)/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.goto('/(coach)/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    expect(realtimeErrors, `Realtime crash detected: ${realtimeErrors.join(' | ')}`).toHaveLength(0);
  });
});
