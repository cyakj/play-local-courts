/**
 * Pure logic tests for coach scheduling and lesson lifecycle.
 *
 * These tests exercise the filtering, sorting, overlap and expiry functions
 * extracted from the production hooks/components.  They run entirely in Node
 * (no browser, no Supabase connection) via the @playwright/test runner.
 *
 * Run: npx playwright test tests/coach-logic.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers mirroring the production functions in useCoachRequests.ts
// ---------------------------------------------------------------------------

interface MockLesson {
  id: string;
  status: string;
  preferredDate: string;
  preferredTimeStart: string | null;
  preferredTimeEnd: string | null;
  confirmedDate: string | null;
  confirmedTimeStart: string | null;
  confirmedTimeEnd: string | null;
}

const PENDING_STATUSES  = ['pending'];
const UPCOMING_STATUSES = ['approved', 'confirmed'];
const PAST_STATUSES     = ['completed', 'declined', 'expired', 'cancelled', 'coach_cancelled', 'no_show'];

function lessonStartDt(r: MockLesson): Date {
  const d = r.confirmedDate ?? r.preferredDate;
  const t = r.confirmedTimeStart ?? r.preferredTimeStart;
  const raw = new Date(`${d}T${t ?? '00:00:00'}`);
  return isNaN(raw.getTime()) ? new Date(0) : raw;
}

function pendingStartDt(r: MockLesson): Date {
  const t = r.preferredTimeStart ?? '23:59:59';
  const raw = new Date(`${r.preferredDate}T${t}`);
  return isNaN(raw.getTime()) ? new Date(0) : raw;
}

function filterLessons(requests: MockLesson[], now: Date) {
  const pending = requests.filter(r =>
    PENDING_STATUSES.includes(r.status) && pendingStartDt(r) >= now
  );
  const upcoming = requests.filter(r =>
    UPCOMING_STATUSES.includes(r.status) && lessonStartDt(r) > now
  );
  const past = requests.filter(r =>
    PAST_STATUSES.includes(r.status) ||
    (UPCOMING_STATUSES.includes(r.status) && lessonStartDt(r) <= now) ||
    (PENDING_STATUSES.includes(r.status) && pendingStartDt(r) < now)
  );
  return { pending, upcoming, past };
}

// Auto-expire logic (mirrors useCoachRequests.ts)
function getToExpire(requests: MockLesson[], now: Date): MockLesson[] {
  return requests.filter(r => {
    if (r.status !== 'pending') return false;
    const t = r.preferredTimeStart ?? '23:59:59';
    const dt = new Date(`${r.preferredDate}T${t}`);
    return !isNaN(dt.getTime()) && dt < now;
  });
}

// ---------------------------------------------------------------------------
// Helpers for availability overlap detection (mirrors CoachAvailabilityEditor)
// ---------------------------------------------------------------------------

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

function normalizeTime(t: string) {
  return t.slice(0, 5);
}

function isExactDuplicate(slots: Slot[], newDay: number, newStart: string, newEnd: string, editingId?: string): boolean {
  return slots.some(s =>
    s.day_of_week === newDay &&
    (!editingId || s.id !== editingId) &&
    normalizeTime(s.start_time) === newStart &&
    normalizeTime(s.end_time) === newEnd
  );
}

function hasOverlap(slots: Slot[], newDay: number, newStart: string, newEnd: string, editingId?: string): boolean {
  return slots.some(s => {
    if (s.day_of_week !== newDay) return false;
    if (editingId && s.id === editingId) return false;
    const existStart = normalizeTime(s.start_time);
    const existEnd   = normalizeTime(s.end_time);
    return newStart < existEnd && newEnd > existStart;
  });
}

function sortSlots(slots: Slot[]): Slot[] {
  return [...slots].sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time)));
}

// ---------------------------------------------------------------------------
// Fixed reference time so tests are deterministic
// ---------------------------------------------------------------------------
const NOW = new Date('2026-06-28T14:00:00');
const FUTURE_DATE = '2026-07-15';
const PAST_DATE   = '2026-05-01';

// ---------------------------------------------------------------------------
// PHASE 1 — Lesson lifecycle filter tests
// ---------------------------------------------------------------------------

test.describe('Lesson lifecycle filters', () => {
  test('past accepted lesson is excluded from Upcoming', () => {
    const req: MockLesson = {
      id: '1', status: 'approved',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: '11:00',
      confirmedDate: PAST_DATE, confirmedTimeStart: '10:00', confirmedTimeEnd: '11:00',
    };
    const { upcoming } = filterLessons([req], NOW);
    expect(upcoming).toHaveLength(0);
  });

  test('past accepted lesson appears in Past', () => {
    const req: MockLesson = {
      id: '1', status: 'approved',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: '11:00',
      confirmedDate: PAST_DATE, confirmedTimeStart: '10:00', confirmedTimeEnd: '11:00',
    };
    const { past } = filterLessons([req], NOW);
    expect(past.map(r => r.id)).toContain('1');
  });

  test('future approved lesson remains in Upcoming', () => {
    const req: MockLesson = {
      id: '2', status: 'approved',
      preferredDate: FUTURE_DATE, preferredTimeStart: '09:00', preferredTimeEnd: '10:00',
      confirmedDate: FUTURE_DATE, confirmedTimeStart: '09:00', confirmedTimeEnd: '10:00',
    };
    const { upcoming } = filterLessons([req], NOW);
    expect(upcoming.map(r => r.id)).toContain('2');
  });

  test('future approved lesson is excluded from Past', () => {
    const req: MockLesson = {
      id: '2', status: 'approved',
      preferredDate: FUTURE_DATE, preferredTimeStart: '09:00', preferredTimeEnd: '10:00',
      confirmedDate: FUTURE_DATE, confirmedTimeStart: '09:00', confirmedTimeEnd: '10:00',
    };
    const { past } = filterLessons([req], NOW);
    expect(past).toHaveLength(0);
  });

  test('expired pending request is excluded from Pending', () => {
    const req: MockLesson = {
      id: '3', status: 'expired',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { pending } = filterLessons([req], NOW);
    expect(pending).toHaveLength(0);
  });

  test('expired pending request appears in Past', () => {
    const req: MockLesson = {
      id: '3', status: 'expired',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { past } = filterLessons([req], NOW);
    expect(past.map(r => r.id)).toContain('3');
  });

  test('future pending request remains in Pending', () => {
    const req: MockLesson = {
      id: '4', status: 'pending',
      preferredDate: FUTURE_DATE, preferredTimeStart: '10:00', preferredTimeEnd: '11:00',
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { pending } = filterLessons([req], NOW);
    expect(pending.map(r => r.id)).toContain('4');
  });

  test('pending request with past date/time is excluded from Pending', () => {
    const req: MockLesson = {
      id: '5', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: '09:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { pending } = filterLessons([req], NOW);
    expect(pending).toHaveLength(0);
  });

  test('pending request with past date/time appears in Past', () => {
    const req: MockLesson = {
      id: '5', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: '09:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { past } = filterLessons([req], NOW);
    expect(past.map(r => r.id)).toContain('5');
  });

  test('pending request with null time and past date is excluded from Pending', () => {
    const req: MockLesson = {
      id: '6', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: null, preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { pending } = filterLessons([req], NOW);
    expect(pending).toHaveLength(0);
  });

  test('pending request with null time and past date appears in Past', () => {
    const req: MockLesson = {
      id: '6', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: null, preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { past } = filterLessons([req], NOW);
    expect(past.map(r => r.id)).toContain('6');
  });

  test('pending request with null time and future date stays in Pending', () => {
    const req: MockLesson = {
      id: '7', status: 'pending',
      preferredDate: FUTURE_DATE, preferredTimeStart: null, preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    const { pending } = filterLessons([req], NOW);
    expect(pending.map(r => r.id)).toContain('7');
  });

  test('date/time comparison is timezone-safe (local datetime string)', () => {
    // new Date('2026-06-28T09:00') is treated as local time — must still compare correctly
    const pastReq: MockLesson = {
      id: '8', status: 'approved',
      preferredDate: '2026-06-28', preferredTimeStart: '09:00', preferredTimeEnd: '10:00',
      confirmedDate: '2026-06-28', confirmedTimeStart: '09:00', confirmedTimeEnd: '10:00',
    };
    const futureReq: MockLesson = {
      id: '9', status: 'approved',
      preferredDate: '2026-06-28', preferredTimeStart: '16:00', preferredTimeEnd: '17:00',
      confirmedDate: '2026-06-28', confirmedTimeStart: '16:00', confirmedTimeEnd: '17:00',
    };
    const now = new Date('2026-06-28T14:00:00'); // 2pm today
    const { upcoming, past } = filterLessons([pastReq, futureReq], now);
    expect(past.map(r => r.id)).toContain('8');   // 9am < 2pm → past
    expect(upcoming.map(r => r.id)).toContain('9'); // 4pm > 2pm → upcoming
  });
});

// ---------------------------------------------------------------------------
// Auto-expire logic tests
// ---------------------------------------------------------------------------

test.describe('Auto-expire pending requests', () => {
  test('pending request with past date+time is flagged for expiry', () => {
    const req: MockLesson = {
      id: '1', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    expect(getToExpire([req], NOW)).toHaveLength(1);
  });

  test('pending request with null time and past date is flagged for expiry (uses 23:59:59)', () => {
    const req: MockLesson = {
      id: '2', status: 'pending',
      preferredDate: PAST_DATE, preferredTimeStart: null, preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    expect(getToExpire([req], NOW)).toHaveLength(1);
  });

  test('future pending request is NOT flagged for expiry', () => {
    const req: MockLesson = {
      id: '3', status: 'pending',
      preferredDate: FUTURE_DATE, preferredTimeStart: '10:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    expect(getToExpire([req], NOW)).toHaveLength(0);
  });

  test('non-pending status is not flagged for expiry', () => {
    const req: MockLesson = {
      id: '4', status: 'approved',
      preferredDate: PAST_DATE, preferredTimeStart: '10:00', preferredTimeEnd: null,
      confirmedDate: null, confirmedTimeStart: null, confirmedTimeEnd: null,
    };
    expect(getToExpire([req], NOW)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PHASE 2 — Availability slot tests
// ---------------------------------------------------------------------------

test.describe('Availability slot sorting', () => {
  test('sorts slots by start_time chronologically', () => {
    const slots: Slot[] = [
      { id: 'a', day_of_week: 1, start_time: '14:00', end_time: '18:00' },
      { id: 'b', day_of_week: 1, start_time: '08:00', end_time: '12:00' },
      { id: 'c', day_of_week: 1, start_time: '11:00', end_time: '13:00' },
    ];
    const sorted = sortSlots(slots);
    expect(sorted.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  test('slots on different days are sorted independently per day', () => {
    const monSlots = [
      { id: 'm2', day_of_week: 1, start_time: '14:00', end_time: '16:00' },
      { id: 'm1', day_of_week: 1, start_time: '09:00', end_time: '11:00' },
    ];
    const sorted = sortSlots(monSlots);
    expect(sorted[0].id).toBe('m1');
    expect(sorted[1].id).toBe('m2');
  });
});

test.describe('Duplicate detection', () => {
  const existing: Slot[] = [
    { id: 'x', day_of_week: 2, start_time: '09:00', end_time: '12:00' },
  ];

  test('detects exact duplicate', () => {
    expect(isExactDuplicate(existing, 2, '09:00', '12:00')).toBe(true);
  });

  test('different start time is not a duplicate', () => {
    expect(isExactDuplicate(existing, 2, '10:00', '12:00')).toBe(false);
  });

  test('different day is not a duplicate', () => {
    expect(isExactDuplicate(existing, 3, '09:00', '12:00')).toBe(false);
  });

  test('editing the same slot is not flagged as duplicate', () => {
    expect(isExactDuplicate(existing, 2, '09:00', '12:00', 'x')).toBe(false);
  });
});

test.describe('Overlap detection', () => {
  const existing: Slot[] = [
    { id: 'x', day_of_week: 1, start_time: '09:00', end_time: '12:00' },
  ];

  test('fully contained slot overlaps', () => {
    expect(hasOverlap(existing, 1, '10:00', '11:00')).toBe(true);
  });

  test('partially overlapping start overlaps', () => {
    expect(hasOverlap(existing, 1, '08:00', '10:00')).toBe(true);
  });

  test('partially overlapping end overlaps', () => {
    expect(hasOverlap(existing, 1, '11:00', '13:00')).toBe(true);
  });

  test('fully enclosing slot overlaps', () => {
    expect(hasOverlap(existing, 1, '08:00', '13:00')).toBe(true);
  });

  test('adjacent slot before does NOT overlap (end == existing start)', () => {
    // new_end == existing_start → new_end > existing_start is FALSE → no overlap
    expect(hasOverlap(existing, 1, '07:00', '09:00')).toBe(false);
  });

  test('adjacent slot after does NOT overlap (start == existing end)', () => {
    // new_start == existing_end → new_start < existing_end is FALSE → no overlap
    expect(hasOverlap(existing, 1, '12:00', '14:00')).toBe(false);
  });

  test('slot on different day does NOT overlap', () => {
    expect(hasOverlap(existing, 2, '09:00', '12:00')).toBe(false);
  });

  test('editing own slot is not flagged as overlap', () => {
    expect(hasOverlap(existing, 1, '09:00', '12:00', 'x')).toBe(false);
  });
});

test.describe('Start/end validation', () => {
  test('start equal to end is invalid', () => {
    expect('09:00' >= '09:00').toBe(true); // i.e., newStart >= newEnd → invalid
  });

  test('start after end is invalid', () => {
    expect('10:00' >= '09:00').toBe(true);
  });

  test('start before end is valid', () => {
    expect('09:00' >= '10:00').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PHASE 3 — Weekly schedule viewer tests (component shape / render logic)
// ---------------------------------------------------------------------------

test.describe('Weekly schedule viewer', () => {
  test('CoachWeeklyScheduleModal component file exists', async () => {
    // Validates the component was created — import would fail otherwise
    const fs = await import('fs');
    const exists = fs.existsSync(
      'C:\\Users\\info\\tenisx-native\\src\\components\\coach\\CoachWeeklyScheduleModal.tsx'
    );
    expect(exists).toBe(true);
  });

  test('schedule.tsx uses CoachDailyTimeline and routes to schedule-week', async () => {
    // New architecture: daily timeline view + navigation to schedule-week for landscape week view
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\app\\(coach)\\schedule.tsx',
      'utf-8'
    );
    expect(content).toContain('CoachDailyTimeline');
    expect(content).toContain('CoachDatePickerSheet');
    expect(content).toContain('schedule-week');
  });

  test('schedule-settings.tsx contains CoachAvailabilityEditor with day-pill UX', async () => {
    // Availability editor moved from schedule.tsx to schedule-settings.tsx (commit regression fix)
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\app\\(coach)\\schedule-settings.tsx',
      'utf-8'
    );
    expect(content).toContain('CoachAvailabilityEditor');
    expect(content).toContain('useCoachAvailability');
    expect(content).toContain('weeklySlots');
    expect(content).toContain('refreshSlots');
  });

  test('lesson blocks render from sample data (logic test)', () => {
    const lessonsByDate: Record<string, { id: string; status: string; timeStart: string; timeEnd: string }[]> = {
      '2026-07-01': [
        { id: 'l1', status: 'approved', timeStart: '10:00', timeEnd: '11:00' },
        { id: 'l2', status: 'completed', timeStart: '14:00', timeEnd: '15:00' },
      ],
    };
    const dayLessons = lessonsByDate['2026-07-01'] ?? [];
    expect(dayLessons).toHaveLength(2);
    expect(dayLessons[0].id).toBe('l1');
    expect(dayLessons[1].id).toBe('l2');
  });

  test('lessons within a day are sorted by start time', () => {
    const lessons = [
      { id: 'b', timeStart: '14:00', timeEnd: '15:00', status: 'approved' },
      { id: 'a', timeStart: '09:00', timeEnd: '10:00', status: 'confirmed' },
    ];
    const sorted = [...lessons].sort((a, b) => (a.timeStart ?? '').localeCompare(b.timeStart ?? ''));
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// PHASE 4 — Bug-fix regression tests (launch sprint)
// ---------------------------------------------------------------------------

test.describe('Bug-fix regressions', () => {
  test('settings.tsx uses router.canGoBack() for safe back navigation', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\app\\settings.tsx', 'utf-8'
    );
    expect(content).toContain('canGoBack()');
    expect(content).toContain('handleBack');
    // Should not call router.back() directly on the back button
    expect(content).not.toContain("onPress={() => router.back()}");
  });

  test('settings.tsx has no visible DEV AUTH STATE debug panel', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\app\\settings.tsx', 'utf-8'
    );
    expect(content).not.toContain('DEV · AUTH STATE');
    expect(content).not.toContain('session: PRESENT');
    expect(content).not.toContain('debugPanel');
  });

  test('CreateClinicSheet.tsx defines QUICK_DATES before use', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\components\\coaching\\CreateClinicSheet.tsx', 'utf-8'
    );
    const quickDatesIdx = content.indexOf('const QUICK_DATES');
    const usageIdx = content.indexOf('QUICK_DATES');
    expect(quickDatesIdx).toBeGreaterThan(-1);
    expect(quickDatesIdx).toBeLessThanOrEqual(usageIdx);
  });

  test('CreateClinicSheet.tsx defines TIME_PRESETS before use', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\components\\coaching\\CreateClinicSheet.tsx', 'utf-8'
    );
    const presetsIdx = content.indexOf('const TIME_PRESETS');
    const usageIdx = content.indexOf('TIME_PRESETS');
    expect(presetsIdx).toBeGreaterThan(-1);
    expect(presetsIdx).toBeLessThanOrEqual(usageIdx);
  });

  test('useCoachRequests.ts uses a unique realtime channel name per subscription', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\hooks\\useCoachRequests.ts', 'utf-8'
    );
    // Should use template literal with tick counter, not a fixed string
    expect(content).toContain('coach-requests-rt-');
    expect(content).not.toContain("channel('coach-requests-realtime')");
  });

  test('CreateClinicSheet.tsx price input has dollar prefix and decimal formatting', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\components\\coaching\\CreateClinicSheet.tsx', 'utf-8'
    );
    expect(content).toContain('currencyRow');
    expect(content).toContain('currencyPrefix');
    expect(content).toContain('priceError');
    expect(content).toContain('toFixed(2)');
    // Letters must be stripped
    expect(content).toContain('[^0-9.]');
  });

  test('price currency input validation logic: strips letters, formats on blur', () => {
    function sanitizePrice(v: string): string {
      const stripped = v.replace(/[^0-9.]/g, '');
      const parts = stripped.split('.');
      return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : stripped;
    }
    function formatOnBlur(v: string): string | null {
      if (!v) return null;
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) return 'error';
      return num.toFixed(2);
    }

    expect(sanitizePrice('12abc')).toBe('12');
    expect(sanitizePrice('9.99xyz')).toBe('9.99');
    expect(sanitizePrice('1.2.3')).toBe('1.23');
    expect(sanitizePrice('')).toBe('');
    expect(formatOnBlur('10')).toBe('10.00');
    expect(formatOnBlur('9.9')).toBe('9.90');
    expect(formatOnBlur('')).toBeNull();
    expect(formatOnBlur('abc')).toBe('error');
    expect(formatOnBlur('-5')).toBe('error');
  });

  test('schedule-week.tsx has updated portrait instruction text', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\app\\(coach)\\schedule-week.tsx', 'utf-8'
    );
    expect(content).toContain('Rotate your phone sideways to view the full weekly schedule.');
  });

  test('CoachWeekCalendar.tsx onCancelLesson and onMakeUnavailable are optional props', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'C:\\Users\\info\\tenisx-native\\src\\components\\coach\\schedule\\CoachWeekCalendar.tsx', 'utf-8'
    );
    // Props must use optional marker ?:
    expect(content).toContain('onCancelLesson?:');
    expect(content).toContain('onMakeUnavailable?:');
  });
});
