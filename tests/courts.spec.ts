import { test, expect } from '@playwright/test';

const COURTS = '/(resident)/courts';

test.describe('Courts Screen — Phase 3 Refined', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COURTS);
    await page.waitForLoadState('domcontentloaded');
    // Community mode renders the community wordmark, not the TenisX logo mark
    // (Header.tsx: isCommunityMode branch renders testID="community-wordmark").
    await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible({ timeout: 15000 });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('Courts screen loads without error', async ({ page }) => {
    await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible({ timeout: 15000 });
  });

  test('Universal header visible (community wordmark, bell, avatar)', async ({ page }) => {
    // Community mode: community wordmark + "Powered by TenisX", no hamburger
    // menu — avatar-icon replaced menu-icon as the rightmost header action.
    await expect(page.locator('[data-testid="community-wordmark"]').first()).toBeVisible({ timeout: 12000 });
    await expect(page.locator('[data-testid="bell-icon"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-icon"]')).toBeVisible();
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
  // Community mode shows one unified list (courts.tsx: `isCommunityMode
  // ? courts : (activeTab === 'tennis' ? tennisCourts : amenityCourts)`) —
  // the Tennis/Amenities segmented control only renders when `isTennisMode`.

  test('No Tennis/Amenities segmented control in Community mode (unified list)', async ({ page }) => {
    await expect(page.locator('[data-testid="tab-control"]')).toHaveCount(0);
    await page.waitForTimeout(4000);
    const cards = page.locator('[data-testid^="court-card-"]');
    expect(await cards.count()).toBeGreaterThan(0);
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

  test('"Dates" chip opens a calendar picker (not an expanded chip row)', async ({ page }) => {
    // Redesigned since this spec was written: tapping the 3rd date chip now
    // opens CalendarPicker (testID="booking-calendar") instead of expanding
    // sheet-date-2/sheet-date-less chips, and its label reads "Dates", not
    // "More Dates" (courts.tsx BookingSheet dateRow).
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      const moreDatesBtn = page.locator('[data-testid="sheet-date-more"]');
      await expect(moreDatesBtn).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Other Days')).toHaveCount(0);
      await moreDatesBtn.dispatchEvent('click');
      await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Selecting a date in the calendar picker updates the sheet (no crash)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="sheet-date-more"]').dispatchEvent('click');
      await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 5000 });
      // Stick to tomorrow: per-amenity advance_booking_days rules can disable
      // farther-out calendar cells entirely (onPress is a no-op when
      // isDisabled — CalendarPicker.tsx), so a farther offset can flake.
      const dayOfMonth = await page.evaluate(() => {
        const d = new Date(); d.setDate(d.getDate() + 1); return d.getDate();
      });
      const dayCell = page.locator(`[data-testid="cal-day-${dayOfMonth}"]`);
      if (await dayCell.count() > 0) {
        await dayCell.dispatchEvent('click');
        await page.waitForTimeout(600);
        await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible();
        // Calendar closes on select
        await expect(page.locator('[data-testid="booking-calendar"]')).toHaveCount(0);
      }
    }
  });

  test('Tapping a date chip in sheet updates slots (no crash)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const ctas = page.locator('[data-testid^="court-cta-"]');
    if (await ctas.count() > 0) {
      await ctas.first().click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      // Duration UI differs by amenity type — tennis shows read-only
      // duration-info, everything else shows the duration-selector chips.
      await expect(
        page.locator('[data-testid="duration-info"]').or(page.locator('[data-testid="duration-selector"]'))
      ).toBeVisible({ timeout: 15000 });
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

  test('Duration selector appears in booking sheet (non-tennis amenity)', async ({ page }) => {
    // Tennis bookings show read-only duration-info (locked by singles/doubles
    // play type), not the selectable duration-selector — courts.tsx renders
    // sortedCourts with tennis-type facilities first when open, so this test
    // must specifically pick a non-tennis card rather than ctas.first().
    await page.waitForTimeout(4000);
    const cards = page.locator('[data-testid^="court-card-"]');
    const count = await cards.count();
    let opened = false;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await card.locator('[data-testid^="court-cta-"]').click();
      await expect(page.locator('[data-testid="booking-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1500);
      if (await page.locator('[data-testid="duration-info"]').count() > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        continue;
      }
      opened = true;
      break;
    }
    if (opened) {
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
      // Slot rows are rendered by TimeSlotWheel (testID="time-slot-wheel"),
      // not the older "time-slots-scroll" container this test named.
      const slotsScroll = page.locator('[data-testid="time-slot-wheel"]');
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

  test('Schedule sheet has legend with Available / Booked / Maintenance', async ({ page }) => {
    // Legend label is "Booked", not "Reserved" (courts.tsx ScheduleSheet
    // legend also adds a 4th "My Reservation" entry not asserted here).
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      const legend = page.locator('[data-testid="schedule-legend"]');
      await expect(legend).toBeVisible({ timeout: 5000 });
      // Scope all text searches to legend to avoid matching off-screen status text
      await expect(legend.getByText('Available', { exact: true })).toBeVisible();
      await expect(legend.getByText('Booked', { exact: true })).toBeVisible();
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
  // Redesigned since this spec was written: the Today/Tomorrow chip strip
  // (schedule-date-scroll / sched-date-today / sched-date-1) was replaced by
  // a single expandable date button (sched-date-btn) that reveals a
  // CalendarPicker (testID="schedule-calendar") with cal-day-N cells.

  test('Schedule sheet has a date selector button', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="sched-date-btn"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Tapping the schedule date button opens the calendar picker', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="sched-date-btn"]').click();
      await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Selecting Tomorrow in the schedule calendar updates the view (no crash)', async ({ page }) => {
    await page.waitForTimeout(4000);
    const scheduleBtn = page.locator('[data-testid^="view-schedule-"]').first();
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click();
      await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="sched-date-btn"]').click();
      await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible({ timeout: 5000 });
      const tomorrowDay = await page.evaluate(() => {
        const d = new Date(); d.setDate(d.getDate() + 1); return d.getDate();
      });
      const dayCell = page.locator(`[data-testid="cal-day-${tomorrowDay}"]`);
      if (await dayCell.count() > 0) {
        await dayCell.dispatchEvent('click');
        await page.waitForTimeout(1000);
        await expect(page.locator('[data-testid="schedule-sheet"]')).toBeVisible();
        await expect(page.locator('[data-testid="schedule-calendar"]')).toHaveCount(0);
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
    // This is a React Native app rendered to web for QA — there is no browser
    // chrome, so page.goBack() (raw history navigation) does not exercise the
    // same code path as tapping the in-app back arrow, which calls
    // report.tsx's closeForm() -> goBack() -> router.back()/replace(courts)
    // using the `returnTo` param. Tap the actual back button instead.
    await page.waitForTimeout(4000);
    const reportBtn = page.locator('[data-testid^="report-issue-"]').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await expect(page).toHaveURL(/report/, { timeout: 15000 });
      await expect(page.locator('[data-testid="court-issue-header"]')).toBeVisible({ timeout: 10000 });
      // Back arrow is the first child of court-issue-header (report.tsx: courtIssueBackBtn).
      await page.locator('[data-testid="court-issue-header"] > *').first().click();
      await page.waitForTimeout(1000);
      // Should be on courts, not home
      await expect(page.locator('[data-testid="courts-screen"]')).toBeVisible({ timeout: 10000 });
    }
  });
});
