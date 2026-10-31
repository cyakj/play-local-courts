/**
 * Workstream E (V1-004): Schedule title + month subtitle scroll with the page.
 * Node only:  npx playwright test -c playwright.logic.config.ts workstream-e-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const cal = readFileSync('src/app/(resident)/calendar.tsx', 'utf8');
const body = cal.slice(cal.indexOf('<View style={styles.screen}>'), cal.indexOf('function useStyles'));

test.describe('Schedule layout', () => {
  test('the heading and month subtitle are INSIDE the page ScrollView; the Header stays outside it', () => {
    const scrollOpen = body.indexOf('<ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content}');
    expect(scrollOpen).toBeGreaterThan(0);
    expect(body.indexOf('<Header variant="resident"')).toBeLessThan(scrollOpen);
    expect(body.indexOf('testID="schedule-heading"')).toBeGreaterThan(scrollOpen);
    expect(body.indexOf('testID="month-label"')).toBeGreaterThan(scrollOpen);
    expect(body.indexOf('testID="schedule-heading"')).toBeLessThan(body.indexOf('testID="view-toggle"'));
  });
  test('no horizontal padding is doubled and no extra vertical scroller was introduced', () => {
    expect(cal).toMatch(/heroInScroll: \{ paddingTop: 12, paddingBottom: 8 \}/);
    expect(cal).not.toMatch(/styles\.hero\b/);
    // the only other ScrollView is the horizontal community chip row
    // (the event-detail Modal has its own scroller; it is not nested in the page)
    const page = body.slice(0, body.indexOf('<Modal'));
    const scrolls = page.match(/<ScrollView[^>]*>/g) ?? [];
    expect(scrolls.filter((s) => !/horizontal/.test(s))).toHaveLength(1);
  });
  test('week/month toggle and calendar navigation remain in the scrolling content', () => {
    for (const id of ['view-toggle-week', 'view-toggle-month', 'calendar-grid']) expect(body).toContain(`testID="${id}"`);
    expect(body).toContain('navigateMonth(-1)');
  });
});
