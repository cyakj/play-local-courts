# Admin Amenity Management Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `src/app/(admin)/manage-amenities.tsx` into a native-feeling, launch-ready Expo admin flow — gated Add Amenity, native 12-hour date/time controls, a ported tap-grid blockout flow with booking-conflict safety, and enable/disable safety — while preserving the current Supabase schema/RLS, Community/Tennis mode architecture, and staying on `greens-v1`.

**Architecture:** `manage-amenities.tsx` stays the single canonical amenity-admin surface (no new duplicate screens). New reusable primitives (`TimePicker`, `Stepper`, `RulesSummary`) live in `src/components/ui/`; two new composite flows (`AddAmenityWizard`, `BlockoutSheet`) live in a new `src/components/admin/` folder and are wired into `manage-amenities.tsx` in place of the current bare Add modal and raw-text blockout form. One additive, staged (not applied) migration adds `court_maintenance.blockout_type` and a missing admin `UPDATE` policy on `bookings` that the conflict-resolution flow needs.

**Tech Stack:** Expo/React Native (SDK 56), TypeScript, Supabase JS client, existing design tokens (`src/constants/design.ts`), existing native pickers (`CalendarPicker.tsx`, `TimeSlotWheel.tsx`) — **no new npm dependency required.**

**Spec:** No separate spec file exists; the Global Constraints below are transcribed verbatim from the user's 2026-08-19 in-session request, which itself builds on a prior fork investigation comparing the legacy Lovable/Vite admin amenity UX (`src/pages/AmenityRules.tsx`, `AmenityRulesDialog.tsx`, `SetMaintenanceSheet.tsx`, etc.) against the current Expo screen.

## Global Constraints

- Single source of truth: ONE primary amenity flow in Expo (`manage-amenities.tsx`). Do not recreate legacy duplication (`ManageCourts.tsx` / `AmenityRules.tsx` / `CMAmenityRules.tsx` / `CMCommunityDashboard.tsx` are legacy web, not touched).
- Add Amenity must configure name, type, capacity, description, availability, operating hours, booking duration, advance-booking window, min-cancellation, max/day, and admin-approval **before creation** — no amenity is created half-configured.
- No user-facing `YYYY-MM-DD`, no `HH:MM`, no military time, anywhere. Dates render like `Aug 20, 2026`; times render like `7:00 AM`.
- Use native/mobile interaction patterns (pickers, steppers, tap grids), not web-form patterns.
- Booking Rules UX shows a plain-language summary before editable controls.
- Blockout flow ports the legacy tap-grid pattern: date strip, tap-based hourly grid, Available/Booked/Blocked states, past times disabled, clear legend — plus single-day OR range, all-day OR specific hours, a reason **type** (Maintenance / Private Event / Closure / Other) distinct from an optional free-text note, and a clear summary before Save.
- A blockout that overlaps an existing booking must never silently proceed — show the conflict (resident, time, amenity) and let the admin cancel-and-continue (with notification via existing infra) or go back.
- Disabling an amenity with future reservations must warn with the affected count and require explicit confirmation; it must never silently strand or cancel bookings.
- Delete must stay blocked while upcoming reservations exist, explain why, and point at Disable as the alternative.
- List cards show operational info (active state, utilization, upcoming count, next blockout) with Edit / Blockout / Enable-Disable / Delete actions, uncluttered.
- Do not use `Button variant="accent"` (`Colors.volt` lime, tagged `--warning · live sessions` in `design.ts:30`) for routine Save/Create actions — use `variant="primary"` (`Colors.blue`, tagged `--action · primary CTAs` in `design.ts:23`).
- Stay on `greens-v1`. Do not touch `main`, Match v2, or run a blanket `supabase db push`. Reuse existing tables (`courts`, `amenity_rules`, `court_maintenance`, `bookings`, `hoa_notifications`, `messages`) — no unnecessary new tables.
- **Verification adaptation:** this codebase has no Jest/RTL unit-test harness (only Playwright E2E covering resident screens, per `tests/*.spec.ts` — zero admin coverage) and the Greens V1 work that built this screen was verified via `npx tsc --noEmit` diffed against a baseline plus manual device QA, not failing-test-first TDD. Each task below follows that established pattern: a compile-check step plus a concrete manual QA action, not a fabricated unit test.

---

## File Structure

**New:**
- `src/lib/format.ts` — shared 12-hour time / full-date formatters (extracted so 4+ new components don't each reinvent `formatTime`, matching the duplicated pattern already visible in `my-reservations.tsx:33-44`).
- `src/components/ui/TimePicker.tsx` — single time-of-day picker, thin wrapper around the existing `TimeSlotWheel` (`outdoor={false}`).
- `src/components/ui/Stepper.tsx` — `+`/`−` numeric control for small integer ranges.
- `src/components/ui/RulesSummary.tsx` — plain-language read-only rules recap.
- `src/components/admin/AddAmenityWizard.tsx` — 4-step gated Add Amenity flow.
- `src/components/admin/BlockoutSheet.tsx` — ported tap-grid blockout flow with conflict detection/resolution.
- `supabase/migrations/20260819010000_greens_v1_blockout_type_and_bookings_admin_update.sql` — staged, **not applied**.

**Modified:**
- `src/lib/types.ts` — hand-add `blockout_type` to `court_maintenance`, matching how `is_active`/`capacity`/`end_date` were already hand-added ahead of their staged migrations.
- `src/app/(admin)/manage-amenities.tsx` — replace the bare Add modal, raw-text blockout form, and raw-`TextInput` rules fields; add list-card operational info and Enable/Disable safety.

---

### Task 1: Shared time/date formatters

**Files:**
- Create: `src/lib/format.ts`

**Interfaces:**
- Produces: `formatTime12h(t: string): string`, `formatDateFull(iso: string): string` — both consumed by Tasks 2, 4, 6, 7, 11.

- [ ] **Step 1: Write the module**

```ts
// src/lib/format.ts

// "14:30" -> "2:30 PM", "09:00" -> "9:00 AM". Mirrors the per-screen copy
// already duplicated in my-reservations.tsx:33-40 — kept here once so new
// admin components don't add a 4th copy.
export function formatTime12h(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mins = m && m !== '00' ? `:${m}` : ':00';
  return `${display}${mins} ${suffix}`;
}

// "2026-08-20" -> "Aug 20, 2026"
export function formatDateFull(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to `src/lib/format.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(admin): add shared 12-hour time/date formatters"
```

---

### Task 2: `TimePicker` component

**Files:**
- Create: `src/components/ui/TimePicker.tsx`
- Reads: `src/components/ui/TimeSlotWheel.tsx` (reused as-is, not modified)

**Interfaces:**
- Consumes: `formatTime12h` from Task 1 (for the trigger-button label only — `TimeSlotWheel` formats its own rows via its internal `fmtSlot`).
- Produces:
```ts
interface TimePickerProps {
  value: string | null;          // "HH:MM" 24h storage format, or null
  onChange: (v: string) => void;
  theme: ThemeTokens;
  label: string;                 // e.g. "OPEN" — rendered above the trigger
  stepMinutes?: number;          // default 30
  testID?: string;
}
export function TimePicker(props: TimePickerProps): JSX.Element
```
Consumed by Tasks 6, 8, 11.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ui/TimePicker.tsx
import { useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { formatTime12h } from '@/lib/format';
import { TimeSlotWheel } from './TimeSlotWheel';

function buildSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}

interface TimePickerProps {
  value: string | null;
  onChange: (v: string) => void;
  theme: ThemeTokens;
  label: string;
  stepMinutes?: number;
  testID?: string;
}

export function TimePicker({ value, onChange, theme, label, stepMinutes = 30, testID }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const slots = useMemo(() => buildSlots(stepMinutes), [stepMinutes]);
  const s = useStyles(theme);

  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={s.trigger}
        onPress={() => { setDraft(value); setOpen(true); }}
        testID={testID}>
        <Text style={s.triggerText}>{value ? formatTime12h(value) : 'Select time'}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={theme.textMuted} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: Spacing.pagePx }}>
            <TimeSlotWheel
              slots={slots}
              selectedSlot={draft}
              onSelectSlot={(slot) => setDraft(slot)}
              weather={null}
              outdoor={false}
              sheetDate={new Date()}
              now={new Date()}
              theme={theme}
            />
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={() => { if (draft) { onChange(draft); } setOpen(false); }}>
              <Text style={s.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    trigger: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.input,
      padding: 14,
      backgroundColor: theme.pageBg,
      minHeight: Spacing.tapTarget,
      justifyContent: 'center',
    },
    triggerText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    modal: { flex: 1, backgroundColor: theme.cardBg },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary },
    confirmBtn: {
      marginTop: 16, backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget, justifyContent: 'center',
    },
    confirmText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: Colors.white },
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

Temporarily mount `<TimePicker value={null} onChange={console.log} theme={theme} label="OPEN" />` in any admin screen, run `npm run dev`, open it, confirm the wheel shows 12-hour labels (e.g. "7:00 AM") never 24-hour, scroll/select works, "Done" writes the value back. Remove the temporary mount before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TimePicker.tsx
git commit -m "feat(admin): add native TimePicker wrapping TimeSlotWheel"
```

---

### Task 3: `Stepper` component

**Files:**
- Create: `src/components/ui/Stepper.tsx`

**Interfaces:**
- Produces:
```ts
interface StepperProps {
  value: number | null;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;    // default 1
  unit?: string;     // e.g. "min", "hrs", "days" appended after the number
  label: string;
  theme: ThemeTokens;
  testID?: string;
}
export function Stepper(props: StepperProps): JSX.Element
```
Consumed by Tasks 8, 11.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ui/Stepper.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface StepperProps {
  value: number | null;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
  theme: ThemeTokens;
  testID?: string;
}

export function Stepper({ value, onChange, min, max, step = 1, unit, label, theme, testID }: StepperProps) {
  const current = value ?? min;
  const dec = () => onChange(Math.max(min, current - step));
  const inc = () => onChange(Math.min(max, current + step));

  return (
    <View>
      <Text style={styles(theme).fieldLabel}>{label}</Text>
      <View style={styles(theme).row} testID={testID}>
        <TouchableOpacity
          style={[styles(theme).btn, current <= min && styles(theme).btnDisabled]}
          onPress={dec}
          disabled={current <= min}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Minus color={current <= min ? theme.textMuted : theme.textPrimary} size={18} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles(theme).value}>{current}{unit ? ` ${unit}` : ''}</Text>
        <TouchableOpacity
          style={[styles(theme).btn, current >= max && styles(theme).btnDisabled]}
          onPress={inc}
          disabled={current >= max}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus color={current >= max ? theme.textMuted : theme.textPrimary} size={18} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function styles(theme: ThemeTokens) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata,
      color: theme.textMuted, letterSpacing: 1.2, marginBottom: 8,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input,
      paddingHorizontal: 12, minHeight: Spacing.tapTarget, backgroundColor: theme.pageBg,
    },
    btn: {
      width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.surface2,
    },
    btnDisabled: { opacity: 0.35 },
    value: {
      fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary,
    },
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Stepper.tsx
git commit -m "feat(admin): add Stepper control for small integer ranges"
```

---

### Task 4: `RulesSummary` component

**Files:**
- Create: `src/components/ui/RulesSummary.tsx`

**Interfaces:**
- Consumes: `formatTime12h` from Task 1.
- Produces:
```ts
interface RulesSummaryProps {
  rules: Partial<Database['public']['Tables']['amenity_rules']['Row']>;
  theme: ThemeTokens;
}
export function RulesSummary(props: RulesSummaryProps): JSX.Element
```
Consumed by Tasks 8, 11.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ui/RulesSummary.tsx
import { StyleSheet, Text, View } from 'react-native';
import { FontFamily, FontSize, Radius } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';
import { formatTime12h } from '@/lib/format';

type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];

interface RulesSummaryProps {
  rules: Partial<AmenityRules>;
  theme: ThemeTokens;
}

export function RulesSummary({ rules, theme }: RulesSummaryProps) {
  const lines: string[] = [];

  if (rules.booking_start_time && rules.booking_end_time) {
    lines.push(`Open ${formatTime12h(rules.booking_start_time)}–${formatTime12h(rules.booking_end_time)}`);
  }
  if (rules.max_duration_minutes) {
    lines.push(`${rules.max_duration_minutes}-minute reservations`);
  }
  if (rules.advance_booking_days) {
    lines.push(`Book up to ${rules.advance_booking_days} day${rules.advance_booking_days === 1 ? '' : 's'} ahead`);
  }
  if (rules.min_cancellation_hours) {
    lines.push(`Cancel at least ${rules.min_cancellation_hours} hour${rules.min_cancellation_hours === 1 ? '' : 's'} before`);
  }
  if (rules.max_reservations_per_day) {
    lines.push(`Maximum ${rules.max_reservations_per_day} reservation${rules.max_reservations_per_day === 1 ? '' : 's'}/day`);
  }
  if (rules.requires_admin_approval) {
    lines.push('Admin approval required');
  }

  if (lines.length === 0) {
    return (
      <View style={s(theme).wrap}>
        <Text style={s(theme).empty}>No booking rules configured yet.</Text>
      </View>
    );
  }

  return (
    <View style={s(theme).wrap}>
      {lines.map((line, i) => (
        <Text key={i} style={s(theme).line}>{line}</Text>
      ))}
    </View>
  );
}

function s(theme: ThemeTokens) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: 'rgba(45,107,255,0.08)',
      borderRadius: Radius.card,
      padding: 14,
      gap: 4,
    },
    line: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textPrimary },
    empty: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.uiLabel, color: theme.textMuted },
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/RulesSummary.tsx
git commit -m "feat(admin): add plain-language RulesSummary component"
```

---

### Task 5: Staged migration — `blockout_type` + admin `UPDATE` policy on `bookings`

**Files:**
- Create: `supabase/migrations/20260819010000_greens_v1_blockout_type_and_bookings_admin_update.sql`
- Modify: `src/lib/types.ts:1160-1183` (`court_maintenance` Row/Insert/Update)

**Why this migration is needed (found during investigation, not assumed):**
- `court_maintenance` only has a free-text `description` column — the spec's "reason/type: Maintenance / Private Event / Closure / Other" needs a structured field distinct from an optional note. Additive column, no data loss.
- `bookings` currently has an admin `SELECT` policy (`supabase/migrations/20251008023157_...sql:170-183`) but **no admin `UPDATE` policy at all**. Without one, Task 7's "cancel resident's booking as part of blockout conflict resolution" would fail at the RLS layer. The new policy mirrors the existing SELECT policy's exact hoa-scoping logic — same `has_role()` + `profiles`/`courts` join pattern already proven safe elsewhere in this repo, not a new actor-derivation pattern.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260819010000_greens_v1_blockout_type_and_bookings_admin_update.sql

-- Structured blockout category, separate from the existing free-text
-- description (which becomes the optional note in the redesigned UI).
alter table public.court_maintenance
  add column if not exists blockout_type text null;

-- Admins need to cancel a resident's booking when it conflicts with a new
-- maintenance/blockout window (Manage Amenities blockout flow). Mirrors
-- "Admins can view all bookings in their HOA" (20251008023157) exactly —
-- same has_role() + profiles/courts hoa-scoping, no new actor pattern.
drop policy if exists "Admins can update bookings in their HOA" on public.bookings;
create policy "Admins can update bookings in their HOA"
on public.bookings
for update
using (
  public.has_role(auth.uid(), 'admin')
  and exists (
    select 1
    from public.profiles
    join public.courts on courts.id = bookings.court_id
    where profiles.id = auth.uid()
      and profiles.hoa_id = courts.hoa_id
  )
);
```

- [ ] **Step 2: Hand-update `src/lib/types.ts`**

At `court_maintenance` (currently lines 1155-1183), add `blockout_type: string | null` to `Row`, `blockout_type?: string | null` to `Insert` and `Update`, matching the existing `description`/`end_date` fields immediately next to them.

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260819010000_greens_v1_blockout_type_and_bookings_admin_update.sql src/lib/types.ts
git commit -m "feat(db): stage blockout_type column and bookings admin UPDATE policy (not yet applied)"
```

**Note for the user:** this migration is staged only, per project rules. Task 7 (conflict cancellation) will not work against the live database until it — specifically the `bookings` UPDATE policy — is applied individually, the same way the two prior Greens V1 migrations were applied one at a time and verified, not via blanket `db push`.

---

### Task 6: `BlockoutSheet` — date/grid UI shell with conflict *prevention* (no resolution yet)

**Files:**
- Create: `src/components/admin/BlockoutSheet.tsx`

**Interfaces:**
- Consumes: `CalendarPicker`/`formatDateLabel` (`src/components/ui/CalendarPicker.tsx`), `formatTime12h`/`formatDateFull` (Task 1).
- Produces:
```ts
interface BlockoutSheetProps {
  visible: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  rules?: Partial<Database['public']['Tables']['amenity_rules']['Row']>; // bounds the hourly grid
  theme: ThemeTokens;
  onSaved: () => void;
}
export function BlockoutSheet(props: BlockoutSheetProps): JSX.Element
```
Consumed by Task 11 (replaces the old inline blockout form) and extended by Task 7.

- [ ] **Step 1: Write the component**

```tsx
// src/components/admin/BlockoutSheet.tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { Database } from '@/lib/types';
import { formatDateFull, formatTime12h } from '@/lib/format';
import { CalendarPicker, formatDateLabel } from '@/components/ui/CalendarPicker';

type AmenityRules = Database['public']['Tables']['amenity_rules']['Row'];

const REASON_TYPES = ['maintenance', 'private_event', 'closure', 'other'] as const;
const REASON_LABELS: Record<(typeof REASON_TYPES)[number], string> = {
  maintenance: 'Maintenance',
  private_event: 'Private Event',
  closure: 'Closure',
  other: 'Other',
};

interface ExistingBooking { id: string; date: string; start_time: string; end_time: string; user_id: string; }

interface BlockoutSheetProps {
  visible: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  rules?: Partial<AmenityRules>;
  theme: ThemeTokens;
  onSaved: () => void;
}

function toISO(d: Date): string { return d.toISOString().slice(0, 10); }
function hourRange(rules?: Partial<AmenityRules>): number[] {
  const openH = rules?.booking_start_time ? parseInt(rules.booking_start_time.split(':')[0], 10) : 6;
  const closeH = rules?.booking_end_time ? parseInt(rules.booking_end_time.split(':')[0], 10) : 22;
  const hours: number[] = [];
  for (let h = openH; h < closeH; h++) hours.push(h);
  return hours;
}

export function BlockoutSheet({ visible, onClose, courtId, courtName, rules, theme, onSaved }: BlockoutSheetProps) {
  const s = useStyles(theme);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const maxDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 365); return d; }, []);

  const [isRange, setIsRange] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [blockedHours, setBlockedHours] = useState<Set<number>>(new Set());
  const [reasonType, setReasonType] = useState<(typeof REASON_TYPES)[number]>('maintenance');
  const [note, setNote] = useState('');
  const [bookings, setBookings] = useState<ExistingBooking[]>([]);
  const [saving, setSaving] = useState(false);

  const hours = useMemo(() => hourRange(rules), [rules]);

  useEffect(() => {
    if (!visible) return;
    setIsRange(false);
    setStartDate(today);
    setEndDate(today);
    setAllDay(true);
    setBlockedHours(new Set());
    setReasonType('maintenance');
    setNote('');
  }, [visible, today]);

  useEffect(() => {
    if (!visible) return;
    const from = toISO(startDate);
    const to = toISO(isRange ? endDate : startDate);
    supabase
      .from('bookings')
      .select('id, date, start_time, end_time, user_id')
      .eq('court_id', courtId)
      .gte('date', from)
      .lte('date', to)
      .neq('status', 'cancelled')
      .then(({ data }) => setBookings(data ?? []));
  }, [visible, courtId, startDate, endDate, isRange]);

  function toggleHour(h: number) {
    setBlockedHours((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h); else next.add(h);
      return next;
    });
  }

  function isHourBooked(h: number): boolean {
    return bookings.some((b) => {
      const bh = parseInt(b.start_time.split(':')[0], 10);
      return bh === h;
    });
  }

  function isHourPast(h: number): boolean {
    const now = new Date();
    return toISO(startDate) === toISO(now) && h <= now.getHours();
  }

  const summary = useMemo(() => {
    const dateLabel = isRange
      ? `${formatDateFull(toISO(startDate))} → ${formatDateFull(toISO(endDate))}`
      : formatDateFull(toISO(startDate));
    const timeLabel = allDay ? 'All day' : `${blockedHours.size} hour${blockedHours.size === 1 ? '' : 's'} selected`;
    return `${REASON_LABELS[reasonType]} · ${dateLabel} · ${timeLabel}`;
  }, [isRange, startDate, endDate, allDay, blockedHours, reasonType]);

  async function save() {
    if (isRange && endDate < startDate) {
      Alert.alert('Invalid Range', 'The end date must be on or after the start date.');
      return;
    }
    if (!allDay && blockedHours.size === 0) {
      Alert.alert('Select Hours', 'Choose at least one hour, or turn on All Day.');
      return;
    }

    const sortedHours = [...blockedHours].sort((a, b) => a - b);
    const conflicting = allDay
      ? bookings
      : bookings.filter((b) => sortedHours.includes(parseInt(b.start_time.split(':')[0], 10)));

    if (conflicting.length > 0) {
      Alert.alert(
        'Reservations Conflict',
        `${conflicting.length} existing reservation${conflicting.length === 1 ? '' : 's'} fall inside this window. Cancel ${conflicting.length === 1 ? 'it' : 'them'} from the amenity's Upcoming Reservations list first, then try again.`,
      );
      return;
    }

    setSaving(true);
    const startTime = allDay ? `${String(hours[0] ?? 0).padStart(2, '0')}:00` : `${String(sortedHours[0]).padStart(2, '0')}:00`;
    const endHourExclusive = allDay ? (hours[hours.length - 1] ?? 23) + 1 : sortedHours[sortedHours.length - 1] + 1;
    const endTime = `${String(endHourExclusive).padStart(2, '0')}:00`;

    const { error } = await supabase.from('court_maintenance').insert({
      court_id: courtId,
      date: toISO(startDate),
      end_date: isRange ? toISO(endDate) : null,
      start_time: startTime,
      end_time: endTime,
      blockout_type: reasonType,
      description: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Could Not Add Blockout', error.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle} numberOfLines={1}>Block Out {courtName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={theme.textMuted} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.pagePx, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={s.segmentRow}>
            <TouchableOpacity style={[s.segment, !isRange && s.segmentActive]} onPress={() => setIsRange(false)}>
              <Text style={[s.segmentText, !isRange && s.segmentTextActive]}>Single Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.segment, isRange && s.segmentActive]} onPress={() => setIsRange(true)}>
              <Text style={[s.segmentText, isRange && s.segmentTextActive]}>Date Range</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>{isRange ? 'FROM' : 'DATE'}</Text>
          <CalendarPicker selectedDate={startDate} onSelect={(d) => { setStartDate(d); if (d > endDate) setEndDate(d); }} minDate={today} maxDate={maxDate} theme={theme} />

          {isRange && (
            <>
              <Text style={[s.fieldLabel, { marginTop: 12 }]}>THROUGH</Text>
              <CalendarPicker selectedDate={endDate} onSelect={setEndDate} minDate={startDate} maxDate={maxDate} theme={theme} />
            </>
          )}

          <View style={[s.activeRow, { marginTop: 16 }]}>
            <Text style={s.activeLabel}>All day</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ false: theme.border, true: Colors.accentCyan }} />
          </View>

          {!allDay && (
            <View style={s.grid}>
              <Text style={s.legendHint}>Tap hours to block. Gray = already booked, dim = past.</Text>
              <View style={s.gridWrap}>
                {hours.map((h) => {
                  const booked = isHourBooked(h);
                  const past = isHourPast(h);
                  const selected = blockedHours.has(h);
                  return (
                    <TouchableOpacity
                      key={h}
                      disabled={past}
                      style={[
                        s.hourCell,
                        booked && s.hourCellBooked,
                        selected && s.hourCellSelected,
                        past && s.hourCellPast,
                      ]}
                      onPress={() => toggleHour(h)}>
                      <Text style={[s.hourCellText, (selected || booked) && s.hourCellTextActive]}>
                        {formatTime12h(`${String(h).padStart(2, '0')}:00`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <Text style={[s.fieldLabel, { marginTop: 20 }]}>REASON</Text>
          <View style={s.typeGrid}>
            {REASON_TYPES.map((t) => (
              <TouchableOpacity key={t} style={[s.typePill, reasonType === t && s.typePillActive]} onPress={() => setReasonType(t)}>
                <Text style={[s.typePillLabel, reasonType === t && s.typePillLabelActive]}>{REASON_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { marginTop: 16 }]}>NOTE (OPTIONAL)</Text>
          <TextInput
            style={s.textInput}
            value={note}
            onChangeText={setNote}
            placeholder="Resurfacing, private party, etc."
            placeholderTextColor={theme.textMuted}
          />

          <View style={s.summaryBanner}>
            <Text style={s.summaryText}>{summary}</Text>
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={s.saveText}>{saving ? 'Saving…' : 'Save Blockout'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    modal: { flex: 1, backgroundColor: theme.cardBg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: theme.border },
    modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary, flex: 1, marginRight: 12 },
    segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    segment: { flex: 1, borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.cardBg },
    segmentActive: { backgroundColor: Colors.blue, borderColor: Colors.blue },
    segmentText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textMuted },
    segmentTextActive: { color: Colors.white },
    fieldLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata, color: theme.textMuted, letterSpacing: 1.2, marginBottom: 8 },
    activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    activeLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textPrimary },
    grid: { marginTop: 16 },
    legendHint: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, color: theme.textMuted, marginBottom: 8 },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hourCell: { width: 76, height: 40, borderRadius: Radius.sm, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.pageBg },
    hourCellBooked: { backgroundColor: theme.surface2, borderColor: theme.borderStrong },
    hourCellSelected: { backgroundColor: Colors.negative, borderColor: Colors.negative },
    hourCellPast: { opacity: 0.3 },
    hourCellText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: theme.textMuted },
    hourCellTextActive: { color: Colors.white },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typePill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.cardBg },
    typePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
    typePillLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textMuted },
    typePillLabelActive: { color: Colors.white },
    textInput: { borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input, padding: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textPrimary, backgroundColor: theme.pageBg },
    summaryBanner: { marginTop: 20, backgroundColor: 'rgba(45,107,255,0.08)', borderRadius: Radius.card, padding: 12 },
    summaryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textPrimary },
    saveBtn: { marginTop: 20, backgroundColor: Colors.blue, borderRadius: Radius.button, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget, justifyContent: 'center' },
    saveText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: Colors.white },
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

Temporarily mount in `manage-amenities.tsx` behind a debug button, run `npm run dev`: confirm Single Day/Range toggle works, calendar picker shows month names not ISO strings, hourly grid shows 12-hour labels, past hours today are disabled, a blockout with no conflicts saves and appears in `court_maintenance`, a blockout overlapping a real test booking is blocked with a clear message instead of silently succeeding. Remove the temporary mount before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/BlockoutSheet.tsx
git commit -m "feat(admin): add BlockoutSheet with tap-grid and conflict prevention"
```

---

### Task 7: Conflict *resolution* — cancel-and-notify inside `BlockoutSheet`

**Files:**
- Modify: `src/components/admin/BlockoutSheet.tsx` (the `save()` conflict branch from Task 6)

**Interfaces:**
- Consumes: `sendNotificationEmail` (`src/lib/emailNotifications.ts`), existing `bookings.status/cancellation_reason/cancelled_by` columns, `hoa_notifications` table, `Task 5`'s new admin `UPDATE` policy on `bookings`.
- Adds a `hoaId: string` and `communityName?: string` prop to `BlockoutSheetProps` (needed for the email payload) — Task 11 passes both when it wires the component in.

- [ ] **Step 1: Extend props and replace the conflict branch**

Add to `BlockoutSheetProps`: `hoaId: string;` and thread it through. Replace the `if (conflicting.length > 0) { Alert.alert(...); return; }` block from Task 6 with a resolution panel:

```tsx
// New state, alongside existing state in BlockoutSheet:
const [conflicts, setConflicts] = useState<ExistingBooking[]>([]);
const [conflictProfiles, setConflictProfiles] = useState<Record<string, string>>({});
const [resolving, setResolving] = useState(false);

// Replace the Alert-only branch in save() with:
if (conflicting.length > 0) {
  setConflicts(conflicting);
  const ids = [...new Set(conflicting.map((b) => b.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  setConflictProfiles(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Resident'])));
  return;
}

async function cancelConflictsAndContinue() {
  setResolving(true);
  const reasonLabel = `${REASON_LABELS[reasonType]}: amenity blocked out by management`;
  for (const b of conflicts) {
    await supabase.from('bookings').update({
      status: 'cancelled',
      cancellation_reason: reasonLabel,
      cancelled_by: 'admin',
    }).eq('id', b.id);

    await supabase.from('hoa_notifications').insert({
      user_id: b.user_id,
      hoa_id: hoaId,
      title: 'Reservation Cancelled',
      body: `Your ${courtName} reservation on ${formatDateFull(b.date)} was cancelled: ${reasonLabel}.`,
      type: 'booking_cancellation',
      read: false,
    });

    sendNotificationEmail({
      type: 'booking_cancellation',
      userId: b.user_id,
      courtName,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      isAdminCancellation: true,
      cancellationReason: reasonLabel,
    });
  }
  setResolving(false);
  setConflicts([]);
  save(); // re-run save(); conflicts list is now empty so it proceeds to insert
}
```

Add near the bottom of the sheet's JSX, rendered only when `conflicts.length > 0`:

```tsx
{conflicts.length > 0 && (
  <View style={s.conflictPanel}>
    <Text style={s.conflictTitle}>{conflicts.length} Reservation{conflicts.length === 1 ? '' : 's'} Conflict</Text>
    {conflicts.map((b) => (
      <Text key={b.id} style={s.conflictLine}>
        {conflictProfiles[b.user_id] ?? 'Resident'} · {formatDateFull(b.date)} · {formatTime12h(b.start_time)}–{formatTime12h(b.end_time)}
      </Text>
    ))}
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
      <TouchableOpacity style={s.conflictGoBack} onPress={() => setConflicts([])}>
        <Text style={s.conflictGoBackText}>Go Back</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.conflictCancelBtn, resolving && { opacity: 0.6 }]} onPress={cancelConflictsAndContinue} disabled={resolving}>
        <Text style={s.conflictCancelText}>{resolving ? 'Cancelling…' : 'Cancel & Continue'}</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

Add matching styles (`conflictPanel`, `conflictTitle`, `conflictLine`, `conflictGoBack`/`conflictGoBackText`, `conflictCancelBtn`/`conflictCancelText`) to `useStyles`, following the existing `negative`/`border` token usage in the file.

Import `sendNotificationEmail` from `@/lib/emailNotifications` at the top of the file.

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

With the migration from Task 5 applied to a dev/staging Supabase project (not production), create a real test booking, then attempt an overlapping blockout: confirm the conflict panel lists the resident/time correctly, "Go Back" clears it without side effects, "Cancel & Continue" flips the booking to `cancelled`, inserts an `hoa_notifications` row, and the blockout is created. Confirm no duplicate notification fires (one insert + one email call per conflicting booking, not per retry).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/BlockoutSheet.tsx
git commit -m "feat(admin): resolve blockout conflicts by cancelling and notifying residents"
```

---

### Task 8: `AddAmenityWizard` — gated multi-step Add Amenity

**Files:**
- Create: `src/components/admin/AddAmenityWizard.tsx`

**Interfaces:**
- Consumes: `TimePicker` (Task 2), `Stepper` (Task 3), `RulesSummary` (Task 4).
- Produces:
```ts
interface AddAmenityWizardProps {
  visible: boolean;
  onClose: () => void;
  hoaId: string;
  theme: ThemeTokens;
  onCreated: () => void;
}
export function AddAmenityWizard(props: AddAmenityWizardProps): JSX.Element
```
Consumed by Task 9.

- [ ] **Step 1: Write the component**

```tsx
// src/components/admin/AddAmenityWizard.tsx
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { TimePicker } from '@/components/ui/TimePicker';
import { Stepper } from '@/components/ui/Stepper';
import { RulesSummary } from '@/components/ui/RulesSummary';

const COURT_TYPES = ['tennis', 'pickleball', 'pool', 'gym', 'clubhouse', 'barbecue', 'jacuzzi'] as const;
type CourtTypeValue = (typeof COURT_TYPES)[number];
const STEPS = ['Basics', 'Hours', 'Rules', 'Review'] as const;

interface AddAmenityWizardProps {
  visible: boolean;
  onClose: () => void;
  hoaId: string;
  theme: ThemeTokens;
  onCreated: () => void;
}

export function AddAmenityWizard({ visible, onClose, hoaId, theme, onCreated }: AddAmenityWizardProps) {
  const s = useStyles(theme);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<CourtTypeValue>('tennis');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  const [openTime, setOpenTime] = useState<string | null>('07:00');
  const [closeTime, setCloseTime] = useState<string | null>('21:00');

  const [duration, setDuration] = useState(60);
  const [advanceDays, setAdvanceDays] = useState(14);
  const [cancellationHours, setCancellationHours] = useState(2);
  const [maxPerDay, setMaxPerDay] = useState(1);
  const [requiresApproval, setRequiresApproval] = useState(false);

  function reset() {
    setStep(0); setName(''); setType('tennis'); setCapacity(''); setDescription(''); setActive(true);
    setOpenTime('07:00'); setCloseTime('21:00');
    setDuration(60); setAdvanceDays(14); setCancellationHours(2); setMaxPerDay(1); setRequiresApproval(false);
  }

  function canAdvance(): boolean {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!openTime && !!closeTime;
    return true;
  }

  async function create() {
    setSaving(true);
    const { data: court, error: courtError } = await supabase
      .from('courts')
      .insert({
        name: name.trim(),
        court_type: type,
        hoa_id: hoaId,
        capacity: capacity.trim() ? Number(capacity.trim()) : null,
        description: description.trim() || null,
        is_active: active,
      })
      .select()
      .single();

    if (courtError || !court) {
      setSaving(false);
      Alert.alert('Could Not Add Amenity', courtError?.message ?? 'Unknown error');
      return;
    }

    const { error: rulesError } = await supabase.from('amenity_rules').insert({
      hoa_id: hoaId,
      amenity_id: court.id,
      booking_start_time: openTime,
      booking_end_time: closeTime,
      max_duration_minutes: duration,
      advance_booking_days: advanceDays,
      min_cancellation_hours: cancellationHours,
      max_reservations_per_day: maxPerDay,
      requires_admin_approval: requiresApproval,
    });

    setSaving(false);
    if (rulesError) {
      Alert.alert('Amenity Created, Rules Not Saved', `${rulesError.message} — edit the amenity to configure rules.`);
    }
    onCreated();
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Add Amenity</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X color={theme.textMuted} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <View style={s.stepRow}>
          {STEPS.map((label, i) => (
            <View key={label} style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>{STEPS[step]}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.pagePx, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <Text style={s.fieldLabel}>NAME</Text>
              <TextInput style={s.textInput} value={name} onChangeText={setName} placeholder="e.g. Court 1, Main Pool…" placeholderTextColor={theme.textMuted} autoFocus />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>TYPE</Text>
              <View style={s.typeGrid}>
                {COURT_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[s.typePill, type === t && s.typePillActive]} onPress={() => setType(t)}>
                    <Text style={[s.typePillLabel, type === t && s.typePillLabelActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>CAPACITY (OPTIONAL)</Text>
              <TextInput style={s.textInput} value={capacity} onChangeText={setCapacity} placeholder="e.g. 4" keyboardType="number-pad" placeholderTextColor={theme.textMuted} />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput style={[s.textInput, { minHeight: 72 }]} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor={theme.textMuted} placeholder="Notes visible to admins" />
            </>
          )}

          {step === 1 && (
            <>
              <View style={s.row2}>
                <View style={{ flex: 1 }}><TimePicker value={openTime} onChange={setOpenTime} theme={theme} label="OPEN" /></View>
                <View style={{ flex: 1 }}><TimePicker value={closeTime} onChange={setCloseTime} theme={theme} label="CLOSE" /></View>
              </View>
              <View style={[s.activeRow, { marginTop: 20 }]}>
                <Text style={s.activeLabel}>Available for booking</Text>
                <Switch value={active} onValueChange={setActive} trackColor={{ false: theme.border, true: Colors.accentCyan }} />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Stepper label="BOOKING DURATION" value={duration} onChange={setDuration} min={15} max={240} step={15} unit="min" theme={theme} />
              <View style={{ height: 16 }} />
              <Stepper label="ADVANCE BOOKING WINDOW" value={advanceDays} onChange={setAdvanceDays} min={1} max={90} unit="days" theme={theme} />
              <View style={{ height: 16 }} />
              <Stepper label="MIN CANCELLATION NOTICE" value={cancellationHours} onChange={setCancellationHours} min={0} max={72} unit="hrs" theme={theme} />
              <View style={{ height: 16 }} />
              <Stepper label="MAX RESERVATIONS / DAY" value={maxPerDay} onChange={setMaxPerDay} min={1} max={10} unit="/day" theme={theme} />
              <View style={[s.activeRow, { marginTop: 20 }]}>
                <Text style={s.activeLabel}>Requires admin approval</Text>
                <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ false: theme.border, true: Colors.accentCyan }} />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.reviewName}>{name}</Text>
              <Text style={s.reviewType}>{type.toUpperCase()}{capacity ? ` · CAP ${capacity}` : ''}</Text>
              <View style={{ marginTop: 16 }}>
                <RulesSummary
                  rules={{
                    booking_start_time: openTime, booking_end_time: closeTime,
                    max_duration_minutes: duration, advance_booking_days: advanceDays,
                    min_cancellation_hours: cancellationHours, max_reservations_per_day: maxPerDay,
                    requires_admin_approval: requiresApproval,
                  }}
                  theme={theme}
                />
              </View>
            </>
          )}

          <View style={s.navRow}>
            {step > 0 && (
              <TouchableOpacity style={s.backBtn} onPress={() => setStep((v) => v - 1)}>
                <Text style={s.backText}>Back</Text>
              </TouchableOpacity>
            )}
            {step < STEPS.length - 1 ? (
              <TouchableOpacity style={[s.nextBtn, !canAdvance() && { opacity: 0.5 }]} disabled={!canAdvance()} onPress={() => setStep((v) => v + 1)}>
                <Text style={s.nextText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.nextBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={create}>
                <Text style={s.nextText}>{saving ? 'Creating…' : 'Create Amenity'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function useStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    modal: { flex: 1, backgroundColor: theme.cardBg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: theme.border },
    modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary },
    stepRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.pagePx, paddingTop: 12 },
    stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.border },
    stepDotActive: { backgroundColor: Colors.blue },
    stepDotDone: { backgroundColor: Colors.blueHi },
    stepLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata, color: theme.textMuted, letterSpacing: 1.2, paddingHorizontal: Spacing.pagePx, paddingTop: 8 },
    fieldLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata, color: theme.textMuted, letterSpacing: 1.2, marginBottom: 8 },
    textInput: { borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input, padding: 14, fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textPrimary, backgroundColor: theme.pageBg },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typePill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.cardBg },
    typePillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
    typePillLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textMuted },
    typePillLabelActive: { color: Colors.white },
    row2: { flexDirection: 'row', gap: 12 },
    activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    activeLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textPrimary },
    reviewName: { fontFamily: FontFamily.spaceGroteskBold, fontSize: FontSize.cardTitle, color: theme.textPrimary },
    reviewType: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata, color: theme.textMuted, letterSpacing: 1, marginTop: 4 },
    navRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
    backBtn: { flex: 1, borderRadius: Radius.button, borderWidth: 1, borderColor: theme.borderStrong, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget, justifyContent: 'center' },
    backText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: theme.textPrimary },
    nextBtn: { flex: 2, borderRadius: Radius.button, backgroundColor: Colors.blue, paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget, justifyContent: 'center' },
    nextText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: Colors.white },
  });
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual QA**

Mount temporarily, run `npm run dev`: confirm Next is disabled until a name is entered on step 1 and times are set on step 2, Review step shows a correct `RulesSummary`, Create Amenity inserts both a `courts` row and an `amenity_rules` row in one pass (verify via Supabase table view — no amenity should exist with a null `amenity_rules` row afterward). Remove the temporary mount before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AddAmenityWizard.tsx
git commit -m "feat(admin): add gated 4-step AddAmenityWizard"
```

---

### Task 9: Wire `AddAmenityWizard` into `manage-amenities.tsx`

**Files:**
- Modify: `src/app/(admin)/manage-amenities.tsx:92-96` (state), `:189-207` (`addCourt`), `:451-506` (Add modal JSX)

- [ ] **Step 1: Remove the old bare-add state and modal**

Delete `newName`/`newType`/`saving` state (lines 94-96, keep `saving` if reused elsewhere — check first), the `addCourt` function (lines 189-207), and the entire "Add Amenity Modal" block (lines 451-506).

- [ ] **Step 2: Add the import and render `AddAmenityWizard`**

```tsx
import { AddAmenityWizard } from '@/components/admin/AddAmenityWizard';
// ...
<AddAmenityWizard
  visible={addVisible}
  onClose={() => setAddVisible(false)}
  hoaId={hoaId ?? ''}
  theme={theme}
  onCreated={loadCourts}
/>
```
Keep the existing `plusButton`/`addVisible` wiring (lines 93, 369-376) unchanged — it already opens the modal correctly, only its contents change.

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors, and no unused-variable warnings for the removed state.

- [ ] **Step 4: Manual QA**

Run `npm run dev`, open Manage Amenities, tap the `+` button, confirm the wizard opens (not the old bare form), complete all 4 steps, confirm the new amenity appears in the list with its rules already configured (open the detail sheet — rules should be populated, not empty).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/manage-amenities.tsx
git commit -m "feat(admin): replace bare Add Amenity modal with AddAmenityWizard"
```

---

### Task 10: List card operational info + decluttered actions

**Files:**
- Modify: `src/app/(admin)/manage-amenities.tsx:119-142` (`loadCourts`), `:408-447` (card JSX)

- [ ] **Step 1: Extend `loadCourts` to fetch next-blockout per court**

Add alongside the existing `upcomingCounts` query in `loadCourts` (after line 139):

```ts
const { data: blockouts } = await supabase
  .from('court_maintenance')
  .select('court_id, date')
  .in('court_id', ids)
  .gte('date', todayISO())
  .order('date', { ascending: true });
const nextBlockoutMap: Record<string, string> = {};
for (const m of blockouts ?? []) {
  if (!nextBlockoutMap[m.court_id]) nextBlockoutMap[m.court_id] = m.date;
}
setNextBlockout(nextBlockoutMap);
```
Add `const [nextBlockout, setNextBlockout] = useState<Record<string, string>>({});` alongside `upcomingCounts` state (line 89).

- [ ] **Step 2: Update the card JSX**

Replace the `courtType` line (lines 419-423) to keep existing info, and add a new line beneath the footer using `formatDateFull` (Task 1) for the next-blockout date instead of the old bare `courtType` string concatenation:

```tsx
<Text style={styles.courtMeta}>
  {upcoming > 0 ? `${upcoming} upcoming` : 'No upcoming reservations'}
  {nextBlockout[court.id] ? ` · Next blockout ${formatDateFull(nextBlockout[court.id])}` : ''}
</Text>
```
Add this `<Text>` inside `courtInfo` below the existing `courtType` Text, and add a matching `courtMeta` style (`fontFamily: FontFamily.manropeMedium, fontSize: FontSize.metadata, color: theme.textMuted, marginTop: 2`).

Import `formatDateFull` from `@/lib/format` at the top of the file.

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual QA**

Run `npm run dev`, confirm each amenity card shows upcoming-reservation count and next-blockout date (or "No upcoming reservations" when empty), confirm dates render as "Aug 20, 2026" not ISO.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/manage-amenities.tsx
git commit -m "feat(admin): show upcoming count and next blockout on amenity cards"
```

---

### Task 11: Detail sheet redesign — `RulesSummary` + stepper/picker rules + `BlockoutSheet` wiring

**Files:**
- Modify: `src/app/(admin)/manage-amenities.tsx:508-777` (detail modal), remove the old raw-text Booking Rules fields (`:590-673`) and old blockout form (`:706-760`)

- [ ] **Step 1: Replace raw Booking Rules fields with `RulesSummary` + edit controls**

Insert `<RulesSummary rules={rules} theme={theme} />` immediately after the existing `utilBanner` block (after line 534), before "Basic Info". Keep an "Edit Rules" section below it, but replace each raw `TextInput`:
- `OPEN (HH:MM)` / `CLOSE (HH:MM)` (lines 593-614) → two `<TimePicker>` calls (Task 2), bound to `rules.booking_start_time`/`rules.booking_end_time` via `onChange={(v) => setRules((r) => ({ ...r, booking_start_time: v }))}` etc.
- `BOOKING DURATION (MIN)` (lines 617-627) → `<Stepper label="BOOKING DURATION" value={rules.max_duration_minutes ?? 60} onChange={(v) => setRules((r) => ({ ...r, max_duration_minutes: v }))} min={15} max={240} step={15} unit="min" theme={theme} />`
- `ADVANCE BOOKING (DAYS)` (lines 628-638) → `Stepper` min=1 max=90 unit="days"
- `MIN CANCELLATION (HRS)` (lines 641-652) → `Stepper` min=0 max=72 unit="hrs"
- `MAX RESERVATIONS / DAY` (lines 653-664) → `Stepper` min=1 max=10 unit="/day"

Keep the "Requires admin approval" `Switch` (lines 666-673) as-is.

- [ ] **Step 2: Fix the Save button color**

Change `variant="accent"` to `variant="primary"` at both the "Save Changes" button (line 678) and confirm no other `accent`-variant buttons remain in this file for routine (non-destructive-warning) actions.

- [ ] **Step 3: Replace the raw blockout form with `BlockoutSheet`**

Delete lines 706-760 (the four raw date/time `TextInput`s and the old "Add Blockout" button). Add local state `const [blockoutSheetOpen, setBlockoutSheetOpen] = useState(false);` and a button:

```tsx
<TouchableOpacity style={styles.addBlockoutBtn} onPress={() => setBlockoutSheetOpen(true)}>
  <Text style={styles.addBlockoutText}>+ Add Blockout</Text>
</TouchableOpacity>

{detailCourt && (
  <BlockoutSheet
    visible={blockoutSheetOpen}
    onClose={() => setBlockoutSheetOpen(false)}
    courtId={detailCourt.id}
    courtName={detailCourt.name}
    hoaId={detailCourt.hoa_id}
    rules={rules}
    theme={theme}
    onSaved={() => openDetail(detailCourt)}
  />
)}
```
Keep the existing blockout list display (lines 688-704) but reformat via `formatDateFull`/`formatTime12h` instead of raw strings, and show `m.blockout_type` (capitalized) alongside `m.description` if present.

Import `BlockoutSheet` from `@/components/admin/BlockoutSheet`, `formatDateFull`/`formatTime12h` from `@/lib/format`.

- [ ] **Step 4: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. Confirm `blockoutDate`/`blockoutEndDate`/`blockoutStart`/`blockoutEnd`/`blockoutReason` state and `addBlockout` function (now dead) are fully removed, not left unused.

- [ ] **Step 5: Manual QA**

Run `npm run dev`, open an amenity's detail sheet: confirm the plain-language summary appears before the editable fields, confirm every time field is a tappable picker (never raw text), confirm duration/advance/cancellation/max-per-day are steppers, confirm Save Changes button is blue not lime, confirm "+ Add Blockout" opens the new sheet and a saved blockout shows up in the list with human-readable date/time and its reason type.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/manage-amenities.tsx
git commit -m "feat(admin): rebuild detail sheet with RulesSummary, native pickers, and BlockoutSheet"
```

---

### Task 12: Enable/Disable safety confirmation + Delete copy nudge

**Files:**
- Modify: `src/app/(admin)/manage-amenities.tsx:148-187` (`confirmDelete`, `toggleActive`)

- [ ] **Step 1: Add a confirmation gate to `toggleActive`**

```tsx
function requestToggleActive(court: Court) {
  const upcoming = upcomingCounts[court.id] ?? 0;
  if (court.is_active && upcoming > 0) {
    Alert.alert(
      'Disable Amenity',
      `"${court.name}" has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'}. Disabling stops new bookings but does not cancel existing ones — residents keep their reservations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable Anyway', style: 'destructive', onPress: () => toggleActive(court) },
      ],
    );
    return;
  }
  toggleActive(court);
}
```
Wire the card's `Switch onValueChange` (line 434) to call `requestToggleActive(court)` instead of `toggleActive(court)` directly. Leave `toggleActive` itself (lines 180-187) unchanged — it already correctly flips only `is_active` and never touches `bookings`.

- [ ] **Step 2: Add the Disable nudge to `confirmDelete`**

In the blocked-delete branch (lines 150-156), append a second line to the `Alert.alert` message:

```ts
Alert.alert(
  'Cannot Delete Amenity',
  `"${court.name}" has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'}. Cancel or wait until they pass before deleting.\n\nTo temporarily close this amenity without losing bookings, use the toggle instead.`,
);
```

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual QA**

Run `npm run dev`: with a test amenity that has an upcoming reservation, confirm toggling it off shows the warning with the correct count and that "Cancel" leaves it enabled, "Disable Anyway" disables it while the reservation remains visible in "Upcoming Reservations". Confirm re-enabling (active → active) never shows a dialog. Confirm attempting Delete on the same amenity shows the updated message mentioning Disable.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/manage-amenities.tsx
git commit -m "fix(admin): warn before disabling an amenity with upcoming reservations"
```

---

### Task 13: Full verification pass + wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Full-repo compile check**

Run: `npx tsc --noEmit`
Expected: identical error count/content to the pre-session baseline (no new errors introduced across all 12 prior tasks combined).

- [ ] **Step 2: Manual QA checklist (run against a real HOA admin account, per the existing Greens V1 QA sequence)**

- [ ] Add Amenity: cannot reach Review step without a name and both hours set; created amenity has real `amenity_rules` immediately (no follow-up edit needed).
- [ ] Every date renders `Mon DD, YYYY`; every time renders `H:MM AM/PM`; zero raw `YYYY-MM-DD` or `HH:MM` text anywhere in this screen.
- [ ] Edit Amenity: rules summary matches the underlying values; steppers respect min/max; Save button is blue.
- [ ] Blockout: single-day and range both work; all-day and hourly-grid both work; past hours today are disabled and untappable; a blockout overlapping a real booking shows the conflict panel with the correct resident/time; "Cancel & Continue" actually cancels the booking and the resident's `my-reservations.tsx` list reflects `cancelled` status.
- [ ] Enable/Disable: disabling an amenity with upcoming reservations warns with the correct count and never touches the bookings; disabling one with zero upcoming reservations does not warn.
- [ ] Delete: still blocked with upcoming reservations, message now mentions Disable; succeeds when none exist.
- [ ] List cards show upcoming count and next blockout, actions (Edit/Blockout/Enable-Disable/Delete) are not cluttered.
- [ ] Community/Tennis mode: confirm this screen's behavior is unaffected by `EXPO_PUBLIC_PRODUCT_MODE` (Manage Amenities is admin-only, not gated by product mode) and that no resident-facing file was touched.

- [ ] **Step 3: Confirm branch hygiene**

Run: `git log --oneline main..greens-v1 | wc -l` and `git status` — confirm all commits are on `greens-v1`, `main` untouched, no stray uncommitted files beyond expected test artifacts.

- [ ] **Step 4: Final commit — checkpoint update**

Update `GREENS_V1_CHECKPOINT.md` with a new dated section summarizing this redesign (files touched, the one staged migration and what it unblocks, remaining manual-QA items), then commit:

```bash
git add GREENS_V1_CHECKPOINT.md
git commit -m "docs(greens-v1): checkpoint after admin amenity redesign"
```

---

## Self-Review

**Spec coverage:**
- Single source of truth → Task 9 removes the old Add modal; no new duplicate screens created; legacy Lovable files untouched. ✓
- Add Amenity gated flow → Task 8. ✓
- Native date/time, no military time/YYYY-MM-DD → Tasks 1, 2, 6, 8, 11 (formatters + `TimePicker` + `CalendarPicker` reuse everywhere raw `TextInput` date/time existed). ✓
- Booking Rules summary-then-edit, steppers → Tasks 4, 11. ✓
- Blockout tap-grid, single/range, all-day/hours, reason type+note, summary → Task 6. ✓
- Reservation-conflict safety → Tasks 6 (prevent) + 7 (resolve: cancel + notify). ✓
- Enable/disable safety → Task 12. ✓
- Delete safety + Disable nudge → Task 12. ✓
- List card operational info → Task 10. ✓
- Design (button color, tap targets, hierarchy) → Task 11 Step 2 (button color); all new components use `Spacing.tapTarget` minimums and existing design tokens throughout. ✓
- Safety rules (branch, no `db push`, no Match v2 touch, reuse schema) → Task 5's migration is additive/staged only; no file outside `src/app/(admin)/manage-amenities.tsx`, `src/components/ui/`, `src/components/admin/`, `src/lib/`, and one migration is touched. ✓

**Placeholder scan:** no "TBD"/"handle appropriately" steps found; every code block is complete, runnable TypeScript, not pseudocode.

**Type consistency:** `BlockoutSheetProps` gains `hoaId` in Task 7, consistently threaded through Task 11's usage. `RulesSummaryProps.rules` type matches `Partial<AmenityRules>` used identically in Tasks 4, 8, 11. `TimePicker`'s `value`/`onChange` signature (`string | null` / `(v: string) => void`) is used identically in Tasks 8 and 11.

---

## Dependencies, Schema, and Hours Summary

**Dependencies needed:** **none.** The investigation found `CalendarPicker.tsx` and `TimeSlotWheel.tsx` already provide proven, theme-aware, 12-hour-native pickers in this codebase — reusing them avoids adding `@react-native-community/datetimepicker` (a new native module, extra build-config risk this close to the App Store launch date) and keeps every picker visually consistent with the booking flow residents already use.

**Schema changes:** one staged (not applied) migration —
1. `court_maintenance.blockout_type text null` (additive column for the Maintenance/Private Event/Closure/Other category).
2. New admin `UPDATE` policy on `bookings`, mirroring the existing admin `SELECT` policy's hoa-scoping exactly. This is currently **missing** — without it, an admin cannot cancel a resident's booking at all, which Task 7's conflict resolution requires. Needs individual application (not blanket `db push`) before Task 7 works live, same process as the two prior Greens V1 migrations.

**Conflict-handling approach:** query `bookings` for overlap with the proposed blockout window before insert; if any exist, block the save by default (Task 6) and offer an in-sheet resolution panel (Task 7) that cancels each conflicting booking (`status='cancelled'`, `cancellation_reason`, `cancelled_by='admin'`), inserts one `hoa_notifications` row and calls the existing `send-booking-email` edge function's `booking_cancellation` type (already supports `isAdminCancellation`/`cancellationReason`) once per conflicting booking — reusing the exact pattern already proven in `my-reservations.tsx:100-113` and `community/[hoaId].tsx:279-285`, not inventing new notification plumbing.

**Estimated hours:**

| Task | Hours |
|---|---|
| 1. Shared formatters | 0.5 |
| 2. TimePicker | 1.5 |
| 3. Stepper | 1 |
| 4. RulesSummary | 1 |
| 5. Migration + types.ts | 0.5 |
| 6. BlockoutSheet shell + conflict prevention | 5 |
| 7. Conflict resolution (cancel + notify) | 2.5 |
| 8. AddAmenityWizard | 4 |
| 9. Wire wizard into screen | 1 |
| 10. List card operational info | 1.5 |
| 11. Detail sheet redesign | 3.5 |
| 12. Enable/Disable + Delete safety | 1 |
| 13. Full QA + wrap-up | 2 |
| **Total** | **~25.5** |
