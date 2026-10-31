/**
 * Notification list rules: true duplicates vs look-alike events, routes, grouping.
 * Shapes mirror the real data (2026-10-29 restore): generic text shared by DIFFERENT reports/bookings, and a few
 * genuine double-writes of the same event.
 * Node only:  npx playwright test -c playwright.logic.config.ts notification-view
 */
import { test, expect } from '@playwright/test';
import {
  bookingLine, collapseDuplicates, dayLabel, groupByDay, kindOf, notificationRoute, reportLine, safeNotificationRoute,
  timeAgo, type ListItem,
} from '../src/lib/notificationView';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const B1 = '33333333-3333-4333-8333-333333333333';

const mk = (over: Partial<ListItem> & { id: string }): ListItem => ({
  ids: [over.id], type: 'report_submitted', title: 'New report', body: 'A new report was submitted',
  createdAt: '2026-10-30T10:00:00Z', read: false, metadata: { report_id: R1 }, count: 1, ...over,
});

test.describe('collapseDuplicates', () => {
  test('REGRESSION: different reports with identical generic text are NOT duplicates', () => {
    const out = collapseDuplicates([
      mk({ id: 'a', metadata: { report_id: R1 }, createdAt: '2026-10-30T10:00:30Z' }),
      mk({ id: 'b', metadata: { report_id: R2 }, createdAt: '2026-10-30T10:00:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });
  test('the same event written twice within the window is folded into one (newest kept, ids merged)', () => {
    const out = collapseDuplicates([
      mk({ id: 'a', createdAt: '2026-10-30T10:00:20Z', read: true }),
      mk({ id: 'b', createdAt: '2026-10-30T10:00:00Z', read: false }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', ids: ['a', 'b'], count: 2, createdAt: '2026-10-30T10:00:20Z' });
    expect(out[0].read).toBe(false); // unread if ANY folded row is unread
  });
  test('the same event on a later day is genuine history, not a duplicate', () => {
    const out = collapseDuplicates([
      mk({ id: 'a', type: 'report_status_changed', createdAt: '2026-10-31T10:00:00Z' }),
      mk({ id: 'b', type: 'report_status_changed', createdAt: '2026-10-30T10:00:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });
  test('same target but different text (a real status change) is kept', () => {
    const out = collapseDuplicates([
      mk({ id: 'a', type: 'report_status_changed', body: 'Now resolved', createdAt: '2026-10-30T10:00:10Z' }),
      mk({ id: 'b', type: 'report_status_changed', body: 'Now in progress', createdAt: '2026-10-30T10:00:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });
  test('two bookings with identical text but different booking ids stay separate', () => {
    const out = collapseDuplicates([
      mk({ id: 'a', type: 'booking_confirmed', title: 'Booking confirmed', body: 'ok', metadata: { booking_id: B1 } }),
      mk({ id: 'b', type: 'booking_confirmed', title: 'Booking confirmed', body: 'ok', metadata: { booking_id: R1 } }),
    ]);
    expect(out).toHaveLength(2);
  });
  test('does not mutate its input', () => {
    const input = [mk({ id: 'a' }), mk({ id: 'b', createdAt: '2026-10-30T10:00:05Z' })];
    collapseDuplicates(input);
    expect(input[0].ids).toEqual(['a']);
    expect(input[0].count).toBe(1);
  });
});

test.describe('notificationRoute', () => {
  test('a report notification opens that report; a booking notification opens that reservation', () => {
    expect(notificationRoute('report_status_changed', { report_id: R1 })).toBe(`/report-detail/${R1}`);
    expect(notificationRoute('report_submitted', { report_id: R2 })).toBe(`/report-detail/${R2}`);
    expect(notificationRoute('booking_confirmed', { booking_id: B1 })).toBe(`/reservation-detail/${B1}`);
  });
  test('an explicit allowlisted route wins; an arbitrary one is ignored', () => {
    expect(notificationRoute('booking_confirmed', { route: `/reservation-detail/${B1}`, booking_id: R1 })).toBe(`/reservation-detail/${B1}`);
    expect(notificationRoute('booking_confirmed', { route: 'https://evil.example/x', booking_id: B1 })).toBe(`/reservation-detail/${B1}`);
    expect(notificationRoute('announcement', { route: '/(admin)/anything' })).toBe('/announcements');
  });
  test('a malformed id never becomes a route; the list screen is the fallback', () => {
    expect(notificationRoute('report_status_changed', { report_id: '../../etc' })).toBe('/my-reports');
    expect(notificationRoute('booking_confirmed', { booking_id: 'x' })).toBe('/my-reservations');
    expect(notificationRoute('booking_cancelled', { amenity_id: 'a', date: '2026-10-30' })).toBe('/my-reservations');
  });
  test('REGRESSION: management review notifications (they carry a booking_id) go to management, never the resident reservation screen', () => {
    expect(notificationRoute('booking_review_needed', { booking_id: B1, route: '/(admin)/manage-amenities' })).toBe('/(admin)/manage-amenities');
    expect(notificationRoute('booking_review_needed', { booking_id: B1 })).toBe('/(admin)/manage-amenities');
  });
  test('types without a destination do nothing', () => {
    expect(notificationRoute('member_approved', { membership_id: R1 })).toBeNull();
    expect(notificationRoute('survey_published', null)).toBeNull();
  });
  test('safeNotificationRoute keeps its original contract', () => {
    expect(safeNotificationRoute(`/report-detail/${R1}`, 'x')).toBe(`/report-detail/${R1}`);
    expect(safeNotificationRoute('/nope', 'announcement')).toBe('/announcements');
    expect(safeNotificationRoute(undefined, 'unknown_type')).toBeNull();
  });
});

test.describe('describing and grouping', () => {
  test('kinds', () => {
    expect(kindOf('booking_confirmed')).toBe('booking');
    expect(kindOf('report_submitted')).toBe('report');
    expect(kindOf('member_application')).toBe('member');
    expect(kindOf('announcement')).toBe('announcement');
    expect(kindOf('whatever')).toBe('other');
  });
  test('lines name the amenity, day and time of the booking, and the place and category of the report', () => {
    expect(bookingLine({ court: 'The Greens Court', date: '2026-10-30', start: '15:00:00', end: '16:30:00' })).toBe('The Greens Court · Fri, Oct 30 · 3:00 PM – 4:30 PM');
    expect(reportLine({ where: 'Pool', category: 'Safety' })).toBe('Pool · Safety');
    expect(reportLine({ where: null, category: 'Safety' })).toBe('Safety');
  });
  test('day labels and sections use local calendar days', () => {
    const now = new Date(2026, 9, 31, 12, 0);
    expect(dayLabel(new Date(2026, 9, 31, 0, 5).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 30, 23, 55).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 27, 9, 0).toISOString(), now)).toBe('Tue, Oct 27');
    const sections = groupByDay([
      { createdAt: new Date(2026, 9, 31, 9).toISOString() },
      { createdAt: new Date(2026, 9, 31, 8).toISOString() },
      { createdAt: new Date(2026, 9, 30, 8).toISOString() },
    ], now);
    expect(sections.map((s) => [s.label, s.items.length])).toEqual([['Today', 2], ['Yesterday', 1]]);
  });
  test('timeAgo', () => {
    const now = Date.parse('2026-10-31T12:00:00Z');
    expect(timeAgo('2026-10-31T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-31T11:15:00Z', now)).toBe('45m ago');
    expect(timeAgo('2026-10-31T07:00:00Z', now)).toBe('5h ago');
    expect(timeAgo('2026-10-29T12:00:00Z', now)).toBe('2d ago');
  });
});
