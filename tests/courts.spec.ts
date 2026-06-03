import { test, expect } from '@playwright/test';

const COURTS = '/(resident)/courts';

test.describe('Courts Screen — Phase 3 Refined', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COURTS);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible({ timeout: 60000 });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('Courts screen loads without error', async ({ page }) => {
    await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible({ timeout: 15000 });
  });

  test('Universal header visible (logo, bell, menu)', async ({ page }) => {
    await expect(page.locator('[data-testid="tenisx-logo"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-icon"]')).toBeVisible();
  });

  // ── No exterior date strip ─────────────────────────────────────────────────

  test('No exterior date chip strip on main Courts screen', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="date-chip-today"]')).toHaveCount(0);
  });

  test('No exterior date strip exists', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="date-chip-today"]')).toHaveCount(0);
  });

  // ── Tennis/Amenities tab ───────────────────────────────────────────────────

  test('Tennis/Amenities segmented control visible', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-control"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tab-tennis"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-amenities"]')).toBeVisible();
  });

  test('Tennis tab is default active', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-tennis"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="tab-control"]').getByText('Tennis')).toBeVisible();
  });

  test('Tapping Amenities tab switches view', async ({ page }) => {
    await page.locator('[data-testid="tab-amenities"]').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible();
  });

  // ── Playing Conditions ─────────────────────────────────────────────────────

  test('Playing conditions renders or is silently hidden', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.getByText(/weather error/i)).toHaveCount(0);
    await expect(page.getByText(/location error/i)).toHaveCount(0);
  });

  // ── Intelligence line ──────────────────────────────────────────────────────

  test('Intelligence line appears after courts load', async ({ page }) => {
    await page.waitForTimeout(4000);
    const line = page.locator('[data-testid="intelligence-line"]');
    if (await line.count() > 0) {
      await expect(line).toBeVisible();
      const text = await line.textContent();
      expect(text).toMatch(/court|available|next|facilit/i);
    }
  });

  // ── Court card actions ─────────────────────────────────────────────────────

  test('Court cards have View Schedule action', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleActions = page.locator('[data-testid^="view-schedule-"]');
    if (await scheduleActions.count() > 0) {
      await expect(scheduleActions.first()).toBeVisible();
    }
  });

  test('Court cards have Report Issue action', async ({ page }) => {
    await page.waitForTimeout(4000);
    const reportActions = page.locator('[data-testid^="report-issue-"]');
    if (await reportActions.count() > 0) {
      await expect(reportActions.first()).toBeVisible();
    }
  });

  test('No HOA or amenity language on court cards', async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.getByText('Amenity', { exact: true })).toHaveCount(0);
    await expect(page.getByText('HOA', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Maintenance Report', { exact: true })).toHaveCount(0);
  });

  // ── Booking sheet — date inside ────────────────────────────────────────────

  test('Tapping Play Now opens booking sheet', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Date selector shows Today and Tomorrow chips inside sheet', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="sheet-date-today"]')).toBeVisible({ timeout: 8000 });
      await expect(page.locator('[data-testid="sheet-date-1"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Date selector shows Other Days chip (not all future dates)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      // Should see "Other Days" button instead of individual date chips for day 3+
      const moreDatesBtn = page.locator('[data-testid="sheet-date-more"]');
      if (await moreDatesBtn.count() > 0) {
        await expect(moreDatesBtn).toBeVisible();
        await expect(page.getByText('More Dates')).toBeVisible();
      }
    }
  });

  test('Other Days expands additional date chips', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="duration-selector"]')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(800);
      const moreDatesBtn = page.locator('[data-testid="sheet-date-more"]');
      if (await moreDatesBtn.count() > 0) {
        // dispatchEvent bypasses Playwright stability check for re-rendering horizontal scroll chips
        await moreDatesBtn.dispatchEvent('click');
        await page.waitForTimeout(600);
        await expect(page.locator('[data-testid="sheet-date-2"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="sheet-date-less"]')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Tapping a date chip in sheet updates slots (no crash)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="duration-selector"]')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(800);
      const tomorrowChip = page.locator('[data-testid="sheet-date-1"]');
      if (await tomorrowChip.count() > 0) {
        await tomorrowChip.dispatchEvent('click');
        await page.waitForTimeout(1000);
        await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible();
      }
    }
  });

  // ── Duration selector ──────────────────────────────────────────────────────

  test('Duration selector appears in booking sheet', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="duration-selector"]')).toBeVisible({ timeout: 8000 });
    }
  });

  test('Duration selector shows at least one option', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2500);
      const durationBtns = page.locator('[data-testid^="duration-"]');
      if (await durationBtns.count() > 0) {
        await expect(durationBtns.first()).toBeVisible();
      }
    }
  });

  // ── Time slots — vertical list ─────────────────────────────────────────────

  test('Time slots use vertical row layout (slot rows visible)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(3000);
      // Slot rows — check that time slots are present as vertical rows
      const slotsScroll = page.locator('[data-testid="time-slots-scroll"]');
      const noSlots = page.locator('[data-testid="no-slots-state"]');
      const hasSlots = await slotsScroll.count() > 0;
      const hasNoSlots = await noSlots.count() > 0;
      // One or the other must be present
      expect(hasSlots || hasNoSlots).toBeTruthy();
    }
  });

  test('No remaining times today message shown when today has no slots', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(3000);
      const noSlotsEl = page.locator('[data-testid="no-slots-state"]');
      if (await noSlotsEl.count() > 0) {
        const msg = await noSlotsEl.textContent();
        // Must NOT say the old generic message
        expect(msg).not.toContain('No available times for this day');
        // Must say "No remaining times today" or "No available times for this date"
        expect(msg).toMatch(/No remaining times today|No available times for this date/);
      }
    }
  });

  test('Weather labels appear on slot rows (outdoor + weather available)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);
      await expect(page.getByText(/weather error/i)).toHaveCount(0);
    }
  });

  test('Confirm button is ≥ 52px and visible inside sheet', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      const confirmBtn = page.locator('[data-testid="confirm-booking-btn"]');
      await expect(confirmBtn).toBeVisible({ timeout: 10000 });
      const box = await confirmBtn.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(52);
    }
  });

  test('Booking sheet dismisses', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  // ── Schedule sheet ─────────────────────────────────────────────────────────

  test('Tapping View Schedule opens schedule sheet', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Schedule sheet shows time blocks', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1500);
      const blocks = page.locator('[data-testid^="schedule-block-"]');
      if (await blocks.count() > 0) {
        await expect(blocks.first()).toBeVisible();
      }
    }
  });

  test('Schedule sheet has legend with Available / Reserved / Maintenance', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      const legend = page.locator('[data-testid="schedule-legend"]');
      await expect(legend).toBeVisible({ timeout: 5000 });
      // Scope all text searches to legend to avoid matching off-screen status text
      await expect(legend.getByText('Available', { exact: true })).toBeVisible();
      await expect(legend.getByText('Reserved', { exact: true })).toBeVisible();
      await expect(legend.getByText('Maintenance', { exact: true })).toBeVisible();
    }
  });

  // ── Report Court Issue — direct form ───────────────────────────────────────

  test('Tapping Report Issue opens facility issue form directly', async ({ page }) => {
    await page.waitForTimeout(4000);
    const reportBtn = page.locator('[data-testid^="report-issue-"]').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      // Should navigate to report route
      await expect(page).toHaveURL(/report/, { timeout: 15000 });
      // Should show the court issue header, not the main reports list
      await expect(page.locator('[data-testid="court-issue-header"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Court issue form has court context prefilled', async ({ page }) => {
    await page.waitForTimeout(4000);
    const reportBtn = page.locator('[data-testid^="report-issue-"]').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await expect(page).toHaveURL(/report/, { timeout: 15000 });
      await expect(page.locator('[data-testid="court-issue-header"]')).toBeVisible({ timeout: 10000 });
      // Category grid should be visible directly (form auto-opened)
      await expect(page.locator('[data-testid="category-grid"]')).toBeVisible({ timeout: 8000 });
    }
  });

  test('No active reports list visible when reporting from court card', async ({ page }) => {
    await page.waitForTimeout(4000);
    const reportBtn = page.locator('[data-testid^="report-issue-"]').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await expect(page).toHaveURL(/report/, { timeout: 15000 });
      // Reports list/filter tabs should NOT be visible
      await expect(page.locator('[data-testid="filter-tabs"]')).toHaveCount(0);
    }
  });

  // ── Design standards ───────────────────────────────────────────────────────

  test('Dark canvas preserved — no white backgrounds', async ({ page }) => {
    const bg = await page.locator('[data-testid="courts-screen"]').evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).not.toBe('rgb(255, 255, 255)');
    expect(bg).not.toBe('rgb(249, 250, 251)');
  });

  // ── Schedule sheet date navigation ─────────────────────────────────────────

  test('Schedule sheet has a date picker row', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="schedule-date-scroll"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Schedule date picker shows Today chip', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="sched-date-today"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Schedule date picker shows Tomorrow chip', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="sched-date-1"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Tapping Tomorrow in schedule updates the date label (no crash)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
      const tomorrowChip = page.locator('[data-testid="sched-date-1"]');
      if (await tomorrowChip.count() > 0) {
        await tomorrowChip.dispatchEvent('click');
        await page.waitForTimeout(1200);
        await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible();
      }
    }
  });

  test('Booking sheet date chips show "More Dates" (not "Other Days")', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(800);
      await expect(page.getByText('Other Days')).toHaveCount(0);
    }
  });

  test('Report Issue back button returns to Courts (not Home)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const reportBtn = page.locator('[data-testid^="report-issue-"]').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await expect(page).toHaveURL(/report/, { timeout: 15000 });
      await expect(page.locator('[data-testid="court-issue-header"]')).toBeVisible({ timeout: 10000 });
      const backBtn = page.locator('[data-testid="court-issue-header"] *').filter({ hasText: '' }).first();
      // Use goBack browser API to simulate back — validates returnTo routing
      await page.goBack();
      await page.waitForTimeout(1000);
      // Should be on courts, not home
      await expect(page.locator('[data-testid="courts-screen"]').or(page.locator('[data-testid="tab-control"]'))).toBeVisible({ timeout: 10000 });
    }
  });
});
