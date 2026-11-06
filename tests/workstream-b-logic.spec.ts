/**
 * Workstream B (V1-011 sheet layout, V1-012 unavailable slots): structure + behaviour guards.
 * Node only:  npx playwright test -c playwright.logic.config.ts workstream-b-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const courts = readFileSync('src/app/(resident)/courts.tsx', 'utf8');
const design = readFileSync('src/constants/design.ts', 'utf8');
const token = (name: string) => design.match(new RegExp(String.raw`\b${name}:\s+'(#[0-9A-Fa-f]{6})'`))?.[1];
const wheel = readFileSync('src/components/ui/TimeSlotWheel.tsx', 'utf8');
const sheet = courts.slice(courts.indexOf('const BookingSheet = memo('), courts.indexOf('function ScheduleSheet'));

test.describe('V1-011 reservation sheet layout', () => {
  test('the sheet height comes from the window, not a device constant, with a short-window fallback', () => {
    expect(sheet).toMatch(/useWindowDimensions\(\)/);
    expect(sheet).toMatch(/const sheetH = Math\.round\(Math\.min\(winH \* 0\.92, 760\)\)/);
    expect(sheet).toMatch(/const constrained = winH < 520/);
    expect(sheet).toMatch(/style=\{\[styles\.sheetContainer, \{ height: sheetH, maxHeight: sheetH \}\]\}/);
  });
  test('in the normal layout the body is a plain View (no outer ScrollView); only the fallback scrolls it', () => {
    expect(sheet).toMatch(/const Body: any = constrained \? ScrollView : View;/);
    expect(sheet).toMatch(/<Body \{\.\.\.bodyProps\}>/);
    expect(sheet).not.toMatch(/<ScrollView showsVerticalScrollIndicator=\{false\} keyboardShouldPersistTaps="handled" contentContainerStyle=\{styles\.sheetScrollContent\}>/);
  });
  test('fixed top / flexible middle / pinned bottom', () => {
    expect(sheet).toMatch(/testID="sheet-middle"/);
    expect(sheet).toMatch(/\{ flex: 1, minHeight: 0 \}/);
    expect(sheet.indexOf('testID="sheet-date-row"')).toBeLessThan(sheet.indexOf('testID="sheet-middle"'));
    expect(sheet.indexOf('testID="sheet-middle"')).toBeLessThan(sheet.indexOf('Sticky confirm area'));
    expect(sheet).toMatch(/<TimeSlotWheel\s+fill/);
  });
  test('background scroll is locked on web while the sheet is open and restored after', () => {
    expect(sheet).toMatch(/document\.body\.style\.overflow = 'hidden'/);
    expect(sheet).toMatch(/document\.body\.style\.overflow = prev/);
  });
  test('the wheel measures its container instead of using a fixed height when asked to fill', () => {
    expect(wheel).toMatch(/fill \? \{ flex: 1, minHeight: MIN_H \}/);
    expect(wheel).toMatch(/onLayout=\{\(e\) => \{[\s\S]*if \(fill && h > 0/);
    expect(wheel).toMatch(/const pad = wheelPad\(wheelH, ITEM_H\)/);
  });
  test('Stage 2 callers of the wheel keep the legacy fixed height (fill is opt-in)', () => {
    expect(wheel).toMatch(/fill = false/);
    expect(readFileSync('src/components/ui/TimePicker.tsx', 'utf8')).not.toMatch(/\bfill\b/);
  });
});

test.describe('V1-012 unavailable slots stay visible but disabled', () => {
  test('semantic availability colors are shared tokens and distinct from each other and from calendar event colors', () => {
    const Availability = { available: token('available'), reserved: token('reserved'), blocked: token('blocked'), selected: token('selected') };
    const vals = Object.values(Availability);
    expect(vals.every(Boolean)).toBe(true);
    expect(new Set(vals).size).toBe(4);
    expect(Availability.selected).toBe(token('blue'));
    for (const eventColor of ['#00D4FF', '#0F1F3D', '#8892A4', '#F97066']) expect(vals).not.toContain(eventColor);
  });
  test('unavailable rows render a non-pressable state pill, never the Select button', () => {
    expect(wheel).toMatch(/if \(slot\.state !== 'available'\) return; \/\/ disabled rows never select/);
    expect(wheel).toMatch(/testID=\{`wheel-unavailable-\$\{slot\.start\}`\}/);
    expect(wheel).toMatch(/accessibilityState=\{\{ disabled: true \}\}/);
    expect(wheel).toMatch(/\{open \? \(\s*<TouchableOpacity/);
  });
  test('legend is rendered next to the wheel with all four states', () => {
    expect(sheet).toMatch(/<ReservationLegend theme=\{theme\} variant="picker"/);
    // UI polish sprint: the visible legend is compact (one-word labels); the full descriptions live in lib/reservationCopy and are each
    // item's accessibility label, so every state keeps its words and its meaning.
    const legend = readFileSync('src/components/ui/ReservationLegend.tsx', 'utf8');
    const copy = readFileSync('src/lib/reservationCopy.ts', 'utf8');
    expect(legend).toContain('accessibilityLabel={label.full}');
    for (const label of ['Available', 'Reserved by someone else', 'Blocked by management', 'Selected', 'My reservation', 'pending approval']) expect(copy).toContain(label);
  });
  test('slot list comes from the pure computeSlots with reservations and blocks kept separate', () => {
    expect(courts).toMatch(/return computeSlots\(\{/);
    expect(courts).toMatch(/toSlotReservation\(b, dateStr, userId, freshNow, tz\)/);
    expect(courts).not.toMatch(/if \(!hasConflict\) slots\.push/);
  });
  test('a wheel selection of a reserved/blocked time is impossible (selectable check shared with the pure module)', () => {
    expect(courts).toMatch(/!timeSlots\.some\(isSelectable\)/);
  });
});

test.describe('booking confirmation safeguards', () => {
  const h = courts.slice(courts.indexOf('const confirmInFlight = useRef(false);'), courts.indexOf('// ── Filtered courts by active tab'));
  test('synchronous re-entrancy guard blocks a double tap before React state updates', () => {
    expect(h).toMatch(/if \(confirmInFlight\.current\) return;\s*confirmInFlight\.current = true;/);
    expect(h).toMatch(/finally \{ confirmInFlight\.current = false; \}/);
  });
  test('availability is revalidated against freshly fetched bookings and blockouts right before the insert', () => {
    const iReval = h.indexOf('revalidateSelection(');
    const iInsert = h.indexOf(".from('bookings').insert(");
    expect(iReval).toBeGreaterThan(0);
    expect(iReval).toBeLessThan(iInsert);
    expect(h).toMatch(/\.from\('court_maintenance'\)\.select\('date, end_date, start_time, end_time'\)/);
    expect(h).toMatch(/fresh !== 'available'/);
  });
  test('half-hour hours and amenity limits are passed to the pure rules (no hour truncation anywhere)', () => {
    expect(courts).not.toMatch(/startHour|endHour/);
    expect(courts).toMatch(/openMins: sheetRules\?\.booking_start_time \? toMins\(sheetRules\.booking_start_time\) : 7 \* 60/);
    expect((courts.match(/max_reservations_per_day \?\? null/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(courts).toMatch(/max_duration_minutes, max_reservations_per_day/);
  });
  test('stale-sheet guard runs after the availability lookup on every path, including a thrown lookup', () => {
    const i = h.indexOf('} catch { /* fall through to the server-side checks */ }');
    const j = h.indexOf('if (isStale()) { setConfirming(false); return; }', i);
    const k = h.indexOf(".from('bookings').insert(");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(j).toBeLessThan(k);
  });
  test('B-001: booking inputs are frozen while a confirmation is in flight', () => {
    expect(sheet).toMatch(/const frozen = confirming \? \(\{ pointerEvents: 'none' \} as const\) : null;/);
    expect(sheet).toMatch(/style: \[styles\.sheetBody, frozen\]/);
  });
  test('B-002: duration cap mirrors the trigger (tennis by play type; others max_duration_minutes default 60)', () => {
    const dur = readFileSync('src/lib/bookingDurations.ts', 'utf8');
    expect(courts).toMatch(/serverDurationCap\(sheetCourtType, sheetPlayType, sheetRules\)/);
    expect(dur).toMatch(/playType === 'doubles' \? \(rules\?\.doubles_duration_minutes \?\? 90\) : \(rules\?\.singles_duration_minutes \?\? 60\)/);
    expect(dur).toMatch(/rules\?\.max_duration_minutes \?\? DEFAULT_DURATION_CAP/);
    expect(courts).toMatch(/maxDurationMins: sheetDurationCap/);
    const mig = readFileSync('supabase/migrations/20260922005928_greens_v1_fix_duration_cap_tennis_vs_amenity.sql', 'utf8');
    expect(mig).toMatch(/COALESCE\(r\.doubles_duration_minutes, 90\)/);
    expect(mig).toMatch(/COALESCE\(r\.max_duration_minutes, 60\)/);
  });
  test('B-003: only confirmed + pending bookings occupy time or count (rejected/cancelled do not) in every booking query', () => {
    expect(courts).toMatch(/const ACTIVE_BOOKING_STATUSES = \['confirmed', 'pending'\]/);
    expect(courts).not.toMatch(/neq\('status', 'cancelled'\)/);
    expect((courts.match(/in\('status', ACTIVE_BOOKING_STATUSES\)/g) ?? []).length).toBeGreaterThanOrEqual(2); // own-bookings load + the pre-migration fallback; others' holds come from get_amenity_busy_times
  });
  test('B-004: booking cache is merged per court and completeness is tracked per (date, court)', () => {
    expect(courts).toMatch(/fetchedBookings = useRef\(new Map<string, number>\(\)\)/);
    // merged per court, and only for the courts whose response is still current (see lib/requestLedger.ts)
    expect(courts).toMatch(/\.filter\(b => !liveIds\.includes\(b\.court_id\)\), \.\.\.\(\(data \?\? \[\]\) as TodayBooking\[\]\)\.filter\(b => liveIds\.includes\(b\.court_id\)\)/);
    expect(courts).toMatch(/fetchedBookings\.current\.get\(`\$\{dateStr\}:\$\{bookingSheet\.courtId\}`\)/);
    expect(courts).not.toMatch(/if \(!bookingsByDate\[dateStr\] && bookingSheet\)/);
  });
  test('server-side backstops remain: exclusion constraint code and blockout trigger message are still handled', () => {
    expect(h).toMatch(/error\.code === '23P01'/);
    expect(h).toMatch(/BLOCKOUT_CONFLICT_MESSAGE/);
    const trig = readFileSync('supabase/migrations/20260922005137_greens_v1_enforce_amenity_booking_rules.sql', 'utf8');
    expect(trig).toMatch(/enforce_amenity_booking_rules/);
  });
  test('date keys use the local calendar day, never a UTC slice', () => {
    expect(courts).not.toMatch(/toISOString\(\)\.split\('T'\)\[0\]/);
  });
});

test.describe('fresh-inspection follow-ups (B)', () => {
  test('RESB-001: a cached date is re-fetched once it is older than the freshness window', () => {
    expect(courts).toMatch(/const BOOKING_CACHE_MS = 30 \* 1000;/);
    expect(courts).toMatch(/fetchedAt === undefined \|\| Date\.now\(\) - fetchedAt > BOOKING_CACHE_MS/);
    expect(courts).toMatch(/fetchedBookings\.current\.set\(`\$\{dateStr\}:\$\{id\}`, Date\.now\(\)\)/);
  });
  test('RESB-002: no weather is shown beyond the real forecast (no fallback to current conditions)', () => {
    expect(wheel).toMatch(/SlotWx \| null \{/);
    expect(wheel).toMatch(/if \(typeof t !== 'number' \|\| typeof r !== 'number'\) return null;/);
    expect(wheel).not.toMatch(/\?\? wx\.tempF|: Math\.round\(wx\.tempF\)|: wx\.rainPct/);
  });
});
