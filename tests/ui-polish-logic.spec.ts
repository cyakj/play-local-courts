/**
 * UI polish sprint (Node only): picker feedback logic, wheel snapping math, reservation-sheet copy and promise rules, Community Pulse
 * (exactly one announcement, urgency only from real metadata, maintenance/service category), badge/chevron layout rules, Expo Go deps.
 *   npx playwright test -c playwright.logic.config.ts ui-polish
 * These do NOT prove the tactile experience, native rendering or real Supabase behaviour: see the physical-iPhone checklist in
 * docs/RESIDENT-UI-POLISH-REPORT-2026-11-01.md.
 */
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  centeredIndex, decideFeedback, newGate, parsePickerPrefs, DEFAULT_PICKER_PREFS, HAPTIC_MIN_GAP_MS, SOUND_MIN_GAP_MS,
} from '../src/lib/pickerFeedback';
import { approvalNotice, availableToBookLine, LEGEND_LABELS, OTHERS_NOT_SHOWN_NOTE } from '../src/lib/reservationCopy';
import { normalizeCategory, pickPulseAnnouncement, categoryLabel } from '../src/lib/announcementsCore';

const read = (p: string) => readFileSync(p, 'utf8');
const on = { userDriven: true, haptics: true, sound: true };

test.describe('wheel snapping math', () => {
  test('the centred row is the nearest 44pt step, clamped to the list; no half-selected resting state', () => {
    expect(centeredIndex(0, 44, 10)).toBe(0);
    expect(centeredIndex(21, 44, 10)).toBe(0);
    expect(centeredIndex(23, 44, 10)).toBe(1);
    expect(centeredIndex(44 * 4, 44, 10)).toBe(4);
    expect(centeredIndex(-30, 44, 10)).toBe(0);
    expect(centeredIndex(9999, 44, 10)).toBe(9);
    expect(centeredIndex(100, 44, 0)).toBe(0);
  });
});

test.describe('picker feedback decisions', () => {
  test('the first observed row only seeds the gate (landing on the initial time is not a scroll)', () => {
    const d = decideFeedback(newGate(), 5, 1000, on);
    expect(d.haptic).toBe(false);
    expect(d.sound).toBe(false);
    expect(d.gate.lastIdx).toBe(5);
  });
  test('one tick per meaningful row change; none when the centred row did not change (refresh / re-render)', () => {
    let g = decideFeedback(newGate(), 5, 0, on).gate;
    const same = decideFeedback(g, 5, 500, on);
    expect(same.haptic).toBe(false);
    const next = decideFeedback(g, 6, 500, on);
    expect(next.haptic).toBe(true);
    g = next.gate;
    expect(decideFeedback(g, 6, 900, on).haptic).toBe(false);
  });
  test('a fast flick does not stack haptics: rows crossed inside the gap are coalesced', () => {
    let g = decideFeedback(newGate(), 0, 0, on).gate;
    let fired = 0;
    for (let i = 1; i <= 20; i++) { const d = decideFeedback(g, i, i * 5, on); g = d.gate; if (d.haptic) fired++; } // a row every 5 ms for 100 ms
    expect(fired).toBeLessThanOrEqual(Math.ceil(100 / HAPTIC_MIN_GAP_MS) + 1);
    expect(fired).toBeGreaterThanOrEqual(2);
  });
  test('sound is throttled separately and more strongly than haptics', () => {
    expect(SOUND_MIN_GAP_MS).toBeGreaterThan(HAPTIC_MIN_GAP_MS);
    let g = decideFeedback(newGate(), 0, 0, on).gate;
    const sounds: number[] = [];
    for (let i = 1; i <= 30; i++) { const d = decideFeedback(g, i, i * 10, on); g = d.gate; if (d.sound) sounds.push(i * 10); }
    for (let i = 1; i < sounds.length; i++) expect(sounds[i] - sounds[i - 1]).toBeGreaterThanOrEqual(SOUND_MIN_GAP_MS);
  });
  test('programmatic scrolls (landing on the selection, tapping Select) update the gate silently', () => {
    const g = decideFeedback(newGate(), 2, 0, on).gate;
    const d = decideFeedback(g, 9, 1000, { ...on, userDriven: false });
    expect(d.haptic || d.sound).toBe(false);
    expect(d.gate.lastIdx).toBe(9);
  });
  test('preferences: haptics only, sound only, neither - each independent', () => {
    const g = decideFeedback(newGate(), 0, 0, on).gate;
    expect(decideFeedback(g, 1, 1000, { userDriven: true, haptics: true, sound: false })).toMatchObject({ haptic: true, sound: false });
    expect(decideFeedback(g, 1, 1000, { userDriven: true, haptics: false, sound: true })).toMatchObject({ haptic: false, sound: true });
    expect(decideFeedback(g, 1, 1000, { userDriven: true, haptics: false, sound: false })).toMatchObject({ haptic: false, sound: false });
  });
  test('defaults: haptics on, sound OFF; corrupt stored prefs fall back to the defaults', () => {
    expect(DEFAULT_PICKER_PREFS).toEqual({ haptics: true, sound: false });
    expect(parsePickerPrefs(null)).toEqual(DEFAULT_PICKER_PREFS);
    expect(parsePickerPrefs('{not json')).toEqual(DEFAULT_PICKER_PREFS);
    expect(parsePickerPrefs('{"sound":true}')).toEqual({ haptics: true, sound: true });
    expect(parsePickerPrefs('{"haptics":"yes"}')).toEqual(DEFAULT_PICKER_PREFS);
  });
});

test.describe('wheel wiring (static)', () => {
  const w = read('src/components/ui/TimeSlotWheel.tsx');
  test('a custom reanimated drum with exact 30-minute snapping, not a plain list', () => {
    expect(w).toContain('useAnimatedScrollHandler');
    expect(w).toContain('snapToInterval={ITEM_H}');
    expect(w).toMatch(/rotateX:/);
    expect(w).toMatch(/perspective:/);
    expect(w).toContain('FadeMask');
    expect(w).toContain('s.band'); // fixed centre indicator
  });
  test('focus is not selection: only the Select button books a time; disabled rows never select', () => {
    expect(w).toContain("if (slot.state !== 'available') return;");
    expect(w).toContain('onPress={() => onSelect(slot, index)}');
    expect(w).not.toMatch(/onSelectSlot\([^)]*centered/i);
  });
  test('haptics only fire from the throttled decision, never directly from the scroll handler or render', () => {
    const handler = w.slice(w.indexOf('const onScroll = useAnimatedScrollHandler'), w.indexOf('const handleSelect'));
    expect(handler).not.toMatch(/hapticTick|soundTick|Haptics\./);
    expect(handler).toContain('scheduleOnRN(onCentreChange');
    expect(w.match(/hapticTick\(\)/g)?.length).toBe(1);
    expect(w).toContain('if (prefsRef.current.haptics) hapticConfirm();'); // firmer confirmation on intentional selection, only if haptics are on
  });
});

test.describe('Expo Go compatibility (static)', () => {
  const pkg = JSON.parse(read('package.json'));
  test('expo-haptics and expo-audio are SDK 58 versions (both included in Expo Go); no extra native dependency', () => {
    expect(pkg.dependencies['expo-haptics']).toMatch(/^~58\./);
    expect(pkg.dependencies['expo-audio']).toMatch(/^~58\./);
    expect(pkg.dependencies['expo-av']).toBeUndefined();
  });
  test('audio: silent switch respected, mixes with other audio, no background session, no microphone permission', () => {
    const r = read('src/lib/pickerFeedbackRuntime.ts');
    expect(r).toContain('playsInSilentMode: false');
    expect(r).toContain("interruptionMode: 'mixWithOthers'");
    expect(r).toContain('shouldPlayInBackground: false');
    expect(JSON.stringify(JSON.parse(read('app.json')).expo.plugins)).toContain('"microphonePermission":false');
  });
  test('the tick sound is an original short asset', () => {
    const f = 'assets/sounds/picker-tick.wav';
    expect(existsSync(f)).toBe(true);
    expect(statSync(f).size).toBeLessThan(10_000);
  });
});

test.describe('reservation sheet copy', () => {
  test('approval notice promises a hold ONLY when the server enforces exclusive pending holds', () => {
    expect(approvalNotice(true, true)).toBe('Approval required · Your time is held until reviewed or it starts.');
    expect(approvalNotice(true, false)).toBe('Approval required · An administrator will review your request.');
    expect(approvalNotice(true, false)).not.toMatch(/held/i);
    expect(approvalNotice(false, true)).toBeNull();
  });
  test('the hold wording is tied to the busy-times function being present (degraded = not enforced)', () => {
    const c = read('src/app/(resident)/courts.tsx');
    expect(c).toContain('approvalNotice(!!rules?.requires_admin_approval, holdsEnforced)');
    // only a SUCCESSFUL busy-times answer proves enforcement; a network/permission failure must not promise a hold
    expect(c).toMatch(/holds: true, data: rows\.map/);
    expect(c.match(/holds: false/g)?.length).toBe(2);
    expect(c).toContain('const [busyHolds, setBusyHolds] = useState(false);');
  });
  test('available-to-book line uses the amenity\'s own hours', () => {
    expect(availableToBookLine({ booking_start_time: '07:00:00', booking_end_time: '19:00:00' })).toBe('Available to book: 7 AM–7 PM');
    expect(availableToBookLine({ booking_start_time: '07:30', booking_end_time: '21:00' })).toBe('Available to book: 7:30 AM–9 PM');
    expect(availableToBookLine({ booking_start_time: null, booking_end_time: '19:00' })).toBeNull();
    expect(availableToBookLine(null)).toBeNull();
  });
  test('temporary limitation note is short and does not claim availability is known', () => {
    expect(OTHERS_NOT_SHOWN_NOTE.length).toBeLessThan(80);
    expect(OTHERS_NOT_SHOWN_NOTE).toMatch(/may be taken/);
  });
  test('legend: six picker states keep one-word labels AND full accessible descriptions', () => {
    for (const k of ['available', 'selected', 'reserved', 'blocked', 'mine', 'pending']) {
      expect(LEGEND_LABELS[k].short.split(' ')).toHaveLength(1);
      expect(LEGEND_LABELS[k].full.length).toBeGreaterThanOrEqual(LEGEND_LABELS[k].short.length);
    }
    expect(LEGEND_LABELS.reserved.full).toBe('Reserved by someone else');
    expect(LEGEND_LABELS.blocked.full).toBe('Blocked by management');
    expect(LEGEND_LABELS.pending.full).toMatch(/pending approval/);
    const l = read('src/components/ui/ReservationLegend.tsx');
    expect(l).toContain('flexWrap');
    expect(l).toContain('accessibilityLabel={label.full}');
  });
  test('the sheet no longer carries the long explanatory sentences', () => {
    const c = read('src/app/(resident)/courts.tsx');
    for (const gone of ["can't be shown yet", 'Open for booking', 'needs administrator approval. Your request will be pending', 'Times outside these hours are not offered']) expect(c).not.toContain(gone);
  });
});

test.describe('My Reservations layout rules (static)', () => {
  const m = read('src/app/my-reservations.tsx');
  const b = read('src/components/ui/ReservationBadge.tsx');
  test('the card body can shrink, the title row wraps, and the chevron has its own non-shrinking slot', () => {
    expect(m).toMatch(/cardBody: \{ flex: 1, minWidth: 0/);
    expect(m).toMatch(/cardTitleRow: \{ flexDirection: 'row', flexWrap: 'wrap'/);
    expect(m).toMatch(/chevronSlot: \{ width: 20, flexShrink: 0/);
    expect(m).toContain('numberOfLines={2}>{b.courtName}');
    expect(m).not.toMatch(/cardTitleRow:[^\n]*justifyContent: 'space-between'/);
  });
  test('the badge is width-bounded and its label wraps instead of overflowing; text is not shrunk', () => {
    expect(b).toMatch(/maxWidth: '100%'/);
    expect(b).toContain('numberOfLines={2}');
    expect(b).not.toMatch(/adjustsFontSizeToFit/);
  });
  test('every status keeps its distinct badge', () => {
    const s = read('src/lib/reservationState.ts');
    for (const label of ['Confirmed', 'In progress', 'Pending approval', 'Request expired', 'Completed', 'Cancelled', 'Declined']) expect(s).toContain(label);
  });
});

test.describe('Community Pulse', () => {
  const rows = (o: Partial<{ id: string; isUrgent: boolean; created_at: string | null }>[]) => o.map((x, i) => ({ id: `a${i}`, isUrgent: false, created_at: '2026-10-01T00:00:00Z', ...x }));
  test('exactly ONE announcement: urgent first, otherwise the newest', () => {
    expect(pickPulseAnnouncement([])).toBeNull();
    const newest = pickPulseAnnouncement(rows([{ id: 'old', created_at: '2026-09-01T00:00:00Z' }, { id: 'new', created_at: '2026-10-20T00:00:00Z' }]));
    expect(newest?.id).toBe('new');
    const urgent = pickPulseAnnouncement(rows([{ id: 'new', created_at: '2026-10-20T00:00:00Z' }, { id: 'urgent-old', isUrgent: true, created_at: '2026-09-01T00:00:00Z' }]));
    expect(urgent?.id).toBe('urgent-old');
  });
  test('urgency comes from metadata only - text such as "URGENT" or "closure" does not set it', () => {
    const a = pickPulseAnnouncement([{ id: 'x', title: 'URGENT: pool closed', isUrgent: false, created_at: '2026-10-01T00:00:00Z' }]);
    expect(a?.isUrgent).toBe(false);
    const src = read('src/lib/announcements.ts');
    expect(src).toContain('isUrgent: r.is_urgent === true');
    expect(src).not.toMatch(/\/urgent\/i|includes\('urgent'|toLowerCase\(\)\.includes/);
  });
  test('maintenance/service announcements are a category, never automatically urgent', () => {
    expect(normalizeCategory('maintenance')).toBe('maintenance');
    expect(normalizeCategory('service')).toBe('service');
    expect(normalizeCategory('anything else')).toBe('general');
    expect(normalizeCategory(null)).toBe('general');
    expect(categoryLabel('maintenance')).toBe('Maintenance');
    expect(categoryLabel('general')).toBeNull();
    const m = read('supabase/migrations/20261101100000_announcement_urgency_and_category.sql');
    expect(m).toContain('is_urgent boolean NOT NULL DEFAULT false'); // default NOT urgent
    expect(m).toContain("category text NOT NULL DEFAULT 'general'");
    expect(m).toContain("CHECK (category IN ('general', 'maintenance', 'service'))");
    expect(m).not.toMatch(/DROP POLICY|CREATE POLICY|GRANT |maintenance_reports\s*\(/);
  });
  test('Home shows one announcement, coral dot only when urgent, and never individual maintenance reports', () => {
    const h = read('src/app/(resident)/index.tsx');
    expect(h).toContain('pickPulseAnnouncement(announcementsRes.rows)');
    expect(h).toContain('announcements.slice(0, 1)');
    expect(h).toContain('{a.isUrgent ? <UrgentDot');
    expect(h).toContain('COMMUNITY PULSE');
    const pulse = h.slice(h.indexOf('Community Pulse (exactly ONE'), h.indexOf('Upcoming Community Events'));
    expect(pulse).not.toMatch(/maintenance_reports|upcomingMaintenance/);
    expect(read('src/components/community/AnnouncementMeta.tsx')).toContain('Colors.coral');
  });
  test('the full lists show the same dot and category; old tests/migrations tolerate a server without the columns', () => {
    for (const f of ['src/app/announcements.tsx', 'src/app/(resident)/community.tsx']) {
      const s = read(f);
      expect(s, f).toContain('UrgentDot');
      expect(s, f).toContain('CategoryChip');
    }
    expect(read('src/lib/announcements.ts')).toContain('isMissingColumnError(error)');
  });
});

test.describe('hosted safety', () => {
  test('this sprint adds only an additive, un-applied migration and a rollback; no hosted write code', () => {
    expect(existsSync('supabase/rollbacks/20261101100000_rollback_announcement_urgency_and_category.sql')).toBe(true);
    for (const f of ['src/lib/pickerFeedbackRuntime.ts', 'src/lib/reservationCopy.ts', 'src/components/ui/TimeSlotWheel.tsx']) expect(read(f), f).not.toMatch(/supabase/);
  });
});

test.describe('Codex review follow-ups', () => {
  test('the helper called from the UI-thread scroll handler is a worklet', () => {
    const s = readFileSync('src/lib/pickerFeedback.ts', 'utf8');
    expect(s).toMatch(/export function centeredIndex\([^)]*\): number \{\s*'worklet';/);
  });
});
