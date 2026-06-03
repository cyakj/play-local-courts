import { test, expect } from '@playwright/test';

test.describe('Theme Mode — Light/Dark Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    // Wait for settings to be interactive (Supabase profile load)
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 30000 });
  });

  // ── Settings toggle ────────────────────────────────────────────────────────

  test('Settings has Appearance segmented control', async ({ page }) => {
    const toggle = page.locator('[data-testid="theme-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="theme-light"]')).toBeVisible();
    await expect(page.locator('[data-testid="theme-dark"]')).toBeVisible();
  });

  test('Default theme is Light (page background is off-white, not dark)', async ({ page }) => {
    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 10000 });

    const bg = await page.locator('[data-testid="home-screen"]').evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // Light mode pageBg #F4F6FA = rgb(244,246,250) — not the dark #0C0F18 = rgb(12,15,24)
    expect(bg).not.toBe('rgb(12, 15, 24)');
  });

  test('Switching to Dark mode changes Home screen background', async ({ page }) => {
    // beforeEach already loaded settings with theme-toggle visible
    // Switch to dark
    await page.locator('[data-testid="theme-dark"]').click();
    await page.waitForTimeout(500);

    // Navigate to home and verify dark bg
    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 10000 });
    const bg = await page.locator('[data-testid="home-screen"]').evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(12, 15, 24)');
  });

  test('Switching to Dark mode changes Courts screen background', async ({ page }) => {
    // Set dark mode in settings first
    await page.goto('/settings');
    const darkBtn = page.locator('[data-testid="theme-dark"]');
    await expect(darkBtn).toBeVisible({ timeout: 10000 });
    await darkBtn.click();
    await page.waitForTimeout(300);

    await page.goto('/(resident)/courts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible({ timeout: 20000 });
    const bg = await page.locator('[data-testid="courts-screen"]').evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(12, 15, 24)');
  });

  test('Header stays dark navy in Light mode', async ({ page }) => {
    // Ensure light mode (default)
    await page.locator('[data-testid="theme-light"]').click();
    await page.waitForTimeout(300);

    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 20000 });

    const headerBg = await page.locator('[data-testid="tenisx-logo"]').first().evaluate(
      (el) => {
        let node = el.parentElement;
        while (node) {
          const bg = window.getComputedStyle(node).backgroundColor;
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          node = node.parentElement;
        }
        return null;
      }
    );
    // Header should be dark navy (#0F2A57 = rgb(15,42,87)) — not light background
    expect(headerBg).not.toContain('244'); // not #F4F6FA light bg
  });

  test('Bottom nav follows theme — white bg in light mode', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('[data-testid="theme-light"]').click();
    await page.waitForTimeout(300);

    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible({ timeout: 20000 });

    const navBg = await page.locator('[data-testid="bottom-nav"]').evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // Light mode nav is white rgb(255,255,255)
    expect(navBg).toBe('rgb(255, 255, 255)');
  });

  test('Theme persists after page refresh', async ({ page }) => {
    // Set dark mode
    await page.locator('[data-testid="theme-dark"]').click();
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Settings should still show dark as active
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    const darkBtn = page.locator('[data-testid="theme-dark"]');
    await expect(darkBtn).toBeVisible({ timeout: 10000 });
    // Dark button should have blue background (active state)
    const darkBtnBg = await darkBtn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    // Active segment = Colors.blue = rgb(45,107,255)
    expect(darkBtnBg).toContain('45');
  });

  test('No white-on-white contrast failure in light mode', async ({ page }) => {
    await page.locator('[data-testid="theme-light"]').click();
    await page.waitForTimeout(300);

    await page.goto('/(resident)');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="home-screen"]')).toBeVisible({ timeout: 10000 });

    // No element with white text (#F5F8FF) on white background should exist
    // Primary text in light mode should be #0C0F18 (navy), not #F5F8FF (white)
    const whiteTextOnWhite = await page.evaluate(() => {
      const allText = document.querySelectorAll('*');
      for (const el of allText) {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        // Check for white-ish text (245,248,255) on white-ish bg (244,246,250)
        if (color === 'rgb(245, 248, 255)' && bg === 'rgb(244, 246, 250)') return true;
      }
      return false;
    });
    expect(whiteTextOnWhite).toBe(false);
  });
});
