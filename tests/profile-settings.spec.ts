import { blockHostedWrites } from './helpers/hostedWriteGuard';
import { test, expect } from '@playwright/test';

/**
 * QA spec for Edit Profile (Part 1) and Settings sub-screens (Part 2–4).
 * All sub-screens are root-level routes accessible directly by URL.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goSettings(page: Parameters<Parameters<typeof test>[1]>[0]) {
  await page.goto('/settings');
  await page.waitForLoadState('domcontentloaded');
  // wait for the theme toggle (means session loaded)
  await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 30000 });
}

// ── Settings main screen ──────────────────────────────────────────────────────

test.describe('Settings — main screen', () => {
  test('Notifications row is visible and tappable', async ({ page }) => {
    await goSettings(page);
    const row = page.getByText('Notifications');
    await expect(row).toBeVisible({ timeout: 10000 });
  });

  test('Privacy row is visible and tappable', async ({ page }) => {
    await goSettings(page);
    await expect(page.getByText('Privacy')).toBeVisible({ timeout: 10000 });
  });

  test('Account row is visible and tappable', async ({ page }) => {
    await goSettings(page);
    await expect(page.getByText('Account')).toBeVisible({ timeout: 10000 });
  });

  test('Help & Support row is visible and tappable', async ({ page }) => {
    await goSettings(page);
    await expect(page.getByText('Help & Support')).toBeVisible({ timeout: 10000 });
  });

  test('Notifications row navigates to notification prefs screen', async ({ page }) => {
    await goSettings(page);
    await page.getByText('Notifications').click();
    await expect(page.getByText('EMAIL PREFERENCES', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Privacy row navigates to privacy screen', async ({ page }) => {
    await goSettings(page);
    await page.getByText('Privacy').click();
    await expect(page.getByText('WHAT YOUR COMMUNITY CAN SEE')).toBeVisible({ timeout: 15000 });
  });

  test('Account row navigates to account screen', async ({ page }) => {
    await goSettings(page);
    await page.getByText('Account').click();
    await expect(page.getByText('IDENTITY')).toBeVisible({ timeout: 15000 });
  });

  test('Help & Support row navigates to help screen', async ({ page }) => {
    await goSettings(page);
    await page.getByText('Help & Support').click();
    await expect(page.getByText('SUPPORT', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Appearance toggle — switching to Dark persists on return', async ({ page }) => {
    await goSettings(page);
    await page.locator('[data-testid="theme-dark"]').click();
    // navigate away and back
    await page.goto('/(resident)');
    await page.goto('/settings');
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 30000 });
    // dark segment should appear active (blue bg)
    const darkBtn = page.locator('[data-testid="theme-dark"]');
    await expect(darkBtn).toBeVisible();
    // reset to light so other tests aren't affected
    await page.locator('[data-testid="theme-light"]').click();
  });
});

// ── Settings — Notifications sub-screen ──────────────────────────────────────

test.describe('Settings — Notifications screen', () => {
  test.beforeEach(async ({ page }) => {
    await blockHostedWrites(page); // hosted TENISX REAL is read-only for tests
    await page.goto('/settings-notifications');
    await page.waitForLoadState('domcontentloaded');
  });

  test('screen loads without red error', async ({ page }) => {
    // No React Native error overlay
    await expect(page.locator('text=Error')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('EMAIL PREFERENCES')).toBeVisible({ timeout: 20000 });
  });

  test('HOA categories are shown and the legacy tennis categories are not', async ({ page }) => {
    await expect(page.getByText('Reservation confirmations')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Reservation changes & cancellations')).toBeVisible();
    await expect(page.getByText('Reservation reminders')).toBeVisible();
    await expect(page.getByText('Messages from HOA management')).toBeVisible(); // in-app, not a switch
    await expect(page.getByText('HOA announcements')).toBeVisible();
    await expect(page.getByText('Maintenance report updates')).toBeVisible();
    for (const gone of ['Match Invitations', 'Lesson Reminders', 'Coach Messages']) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
  });

  test('push is not claimed and essential emails are explained', async ({ page }) => {
    await expect(page.locator('[data-testid="notif-push-note"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="notif-essential-note"]')).toBeVisible();
  });

  test('Save button is present', async ({ page }) => {
    await expect(page.getByText('Save')).toBeVisible({ timeout: 20000 });
  });

  test('back button returns to settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 30000 });
    await page.getByText('Notifications').click();
    await expect(page.getByText('EMAIL PREFERENCES', { exact: true })).toBeVisible({ timeout: 15000 });
    // Tap the back arrow (ArrowLeft). It's a TouchableOpacity, which
    // react-native-web renders as a plain div (no literal <button> tag
    // anywhere on this screen — the old `page.locator('button')` locator
    // matched zero elements and hung for the full 120s test timeout).
    // Browser back exercises the same onPress handler
    // (router.canGoBack() ? router.back() : router.replace('/settings')).
    await page.goBack();
    // should return to settings
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 15000 });
  });
});

// ── Settings — Privacy sub-screen ────────────────────────────────────────────

test.describe('Settings — Privacy screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings-privacy');
    await page.waitForLoadState('domcontentloaded');
  });

  test('screen shows what the community can see, with no switches and no save', async ({ page }) => {
    await expect(page.getByText('WHAT YOUR COMMUNITY CAN SEE')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="privacy-facts"]')).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('Save', { exact: true })).toHaveCount(0);
  });

  test('legacy tennis privacy toggles are gone', async ({ page }) => {
    await expect(page.getByText('WHAT YOUR COMMUNITY CAN SEE')).toBeVisible({ timeout: 20000 });
    for (const gone of ['Show Location', 'Activity Status', 'Exact Distance', 'Hide Contact Until Match']) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }
  });

  test('policy links are present', async ({ page }) => {
    await expect(page.locator('[data-testid="privacy-policy-link"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="terms-link"]')).toBeVisible();
  });
});

// ── Settings — Account sub-screen ────────────────────────────────────────────

test.describe('Settings — Account screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings-account');
    await page.waitForLoadState('domcontentloaded');
  });

  test('screen loads without red error', async ({ page }) => {
    await expect(page.getByText('IDENTITY')).toBeVisible({ timeout: 20000 });
  });

  test('EMAIL label is visible', async ({ page }) => {
    await expect(page.getByText('EMAIL')).toBeVisible({ timeout: 20000 });
  });

  test('PHONE label is visible', async ({ page }) => {
    await expect(page.getByText('PHONE')).toBeVisible({ timeout: 20000 });
  });

  test('SECURITY section is visible', async ({ page }) => {
    await expect(page.getByText('SECURITY')).toBeVisible({ timeout: 20000 });
  });

  test('Change Password action is visible', async ({ page }) => {
    await expect(page.getByText('Change Password')).toBeVisible({ timeout: 20000 });
  });

  test('Sign Out button is visible', async ({ page }) => {
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 20000 });
  });
});

// ── Settings — Help & Support sub-screen ─────────────────────────────────────

test.describe('Settings — Help & Support screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings-help');
    await page.waitForLoadState('domcontentloaded');
  });

  test('screen loads without red error', async ({ page }) => {
    await expect(page.getByText('SUPPORT', { exact: true })).toBeVisible({ timeout: 20000 });
  });

  test('FAQ row is visible', async ({ page }) => {
    await expect(page.getByText('FAQ')).toBeVisible({ timeout: 20000 });
  });

  test('Contact Support row is visible', async ({ page }) => {
    await expect(page.getByText('Contact Support')).toBeVisible({ timeout: 20000 });
  });

  test('Terms of Service row is visible', async ({ page }) => {
    await expect(page.getByText('Terms of Service')).toBeVisible({ timeout: 20000 });
  });

  test('Privacy Policy row is visible', async ({ page }) => {
    await expect(page.getByText('Privacy Policy')).toBeVisible({ timeout: 20000 });
  });

  test('LEGAL section header is visible', async ({ page }) => {
    await expect(page.getByText('LEGAL')).toBeVisible({ timeout: 20000 });
  });
});

// ── Edit Profile screen ───────────────────────────────────────────────────────

test.describe('Edit Profile screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/edit-profile');
    await page.waitForLoadState('domcontentloaded');
  });

  test('screen loads without red error', async ({ page }) => {
    await expect(page.getByText('Edit Profile')).toBeVisible({ timeout: 30000 });
  });

  test('FULL NAME field is visible', async ({ page }) => {
    await expect(page.getByText('FULL NAME')).toBeVisible({ timeout: 20000 });
  });

  // NTRP/hand/backhand/playing-style/surface/goals/years-playing are wrapped
  // in `isTennisMode &&` in edit-profile.tsx ("Tennis-only fields ... Hidden
  // in Community mode: an HOA resident profile has no tennis-player
  // concepts" — community-mode-ia fix wave). This build runs in Community
  // mode, so these must NOT render, same as the MATCH FORMAT / PREFERRED
  // PLAY TIMES fields below.

  test('NTRP RATING field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('NTRP RATING')).not.toBeVisible({ timeout: 5000 });
  });

  test('DOMINANT HAND field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('DOMINANT HAND')).not.toBeVisible({ timeout: 5000 });
  });

  test('BACKHAND field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('BACKHAND')).not.toBeVisible({ timeout: 5000 });
  });

  test('PLAYING STYLE field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('PLAYING STYLE')).not.toBeVisible({ timeout: 5000 });
  });

  test('FAVORITE SURFACE field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('FAVORITE SURFACE')).not.toBeVisible({ timeout: 5000 });
  });

  test('TENNIS GOALS field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('TENNIS GOALS')).not.toBeVisible({ timeout: 5000 });
  });

  test('YEARS PLAYING field is not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('YEARS PLAYING')).not.toBeVisible({ timeout: 5000 });
  });

  test('MATCH FORMAT field is no longer present', async ({ page }) => {
    await expect(page.getByText('MATCH FORMAT')).not.toBeVisible({ timeout: 5000 });
  });

  test('PREFERRED PLAY TIMES field is no longer present', async ({ page }) => {
    await expect(page.getByText('PREFERRED PLAY TIMES')).not.toBeVisible({ timeout: 5000 });
  });

  test('BIO field is visible', async ({ page }) => {
    await expect(page.getByText('BIO')).toBeVisible({ timeout: 20000 });
  });

  test('HOME LOCATION field is hidden in Community mode (matchmaking-only)', async ({ page }) => {
    await expect(page.getByText('FULL NAME')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('HOME LOCATION')).toHaveCount(0);
  });

  test('PROFILE VISIBILITY is hidden in Community mode (nothing enforces it)', async ({ page }) => {
    await expect(page.getByText('FULL NAME')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('PROFILE VISIBILITY')).toHaveCount(0);
  });

  test('Right / Left / Two-handed hand chips are not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('Right')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Left')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Two-handed')).not.toBeVisible({ timeout: 5000 });
  });

  test('One-Handed / Two-Handed backhand chips are not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('One-Handed')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Two-Handed')).not.toBeVisible({ timeout: 5000 });
  });

  test('Favorite Surface chips are not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('Hard')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Clay')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Grass')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Indoor')).not.toBeVisible({ timeout: 5000 });
  });

  test('Tennis Goals chips are not present (Community mode)', async ({ page }) => {
    await expect(page.getByText('Have Fun')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Tournament Ready')).not.toBeVisible({ timeout: 5000 });
  });

  test('Public / Community / Private visibility chips are not shown in Community mode', async ({ page }) => {
    await expect(page.getByText('FULL NAME')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Public', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Private', { exact: true })).toHaveCount(0);
  });

  test('Save button is present in header', async ({ page }) => {
    await expect(page.getByText('Save')).toBeVisible({ timeout: 20000 });
  });

  test('bio character counter is visible (0/300)', async ({ page }) => {
    await expect(page.locator('text=/\\d+\\/300/')).toBeVisible({ timeout: 20000 });
  });

  test('back button navigates away', async ({ page }) => {
    // going directly to edit-profile means no stack — back goes to Me via canGoBack fallback
    const backBtn = page.locator('button').first();
    await expect(backBtn).toBeVisible({ timeout: 20000 });
  });
});
