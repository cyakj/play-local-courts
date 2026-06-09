# Coach Schedule Control Panel — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple availability grid editor with a layered Schedule Control Panel giving coaches structured management of Global Hours, Facility Hours, Travel Availability, and Blockouts — with a public visibility toggle on each entry.

**Architecture:** Four new Supabase tables. Four new hooks. Six new React Native components inside `src/components/coach/schedule/`. One new screen `src/app/(coach)/schedule-settings.tsx`. The existing `schedule.tsx` loses its grid editor and gains a "Manage Schedule" navigation card. Existing `coach_availability` and `coach_unavailability` tables are untouched — the booking flow is unaffected.

**Tech Stack:** React Native 0.85, TypeScript, Expo Router 56, Supabase, Lucide React Native, `react-native-safe-area-context`

---

## Files

| Action | File |
|---|---|
| Create | `supabase/migrations/<timestamp>_coach_schedule_control_panel.sql` |
| Create | `src/hooks/useCoachGlobalHours.ts` |
| Create | `src/hooks/useCoachFacilityHours.ts` |
| Create | `src/hooks/useCoachTravelHours.ts` |
| Create | `src/hooks/useCoachBlockouts.ts` |
| Create | `src/components/coach/schedule/SectionCard.tsx` |
| Create | `src/components/coach/schedule/GlobalHoursSection.tsx` |
| Create | `src/components/coach/schedule/FacilityHoursSection.tsx` |
| Create | `src/components/coach/schedule/TravelHoursSection.tsx` |
| Create | `src/components/coach/schedule/BlockoutsSection.tsx` |
| Create | `src/components/coach/schedule/ScheduleColorKey.tsx` |
| Create | `src/app/(coach)/schedule-settings.tsx` |
| Modify | `src/app/(coach)/schedule.tsx` |
| Modify | `src/app/(coach)/_layout.tsx` |

---

## Task 1: DB Migration — 4 new tables

**Files:**
- Create: `supabase/migrations/20260609120000_coach_schedule_control_panel.sql`

- [ ] **Create the migration file with this exact content:**

```sql
-- coach_global_hours: per-day outer boundary for coaching
CREATE TABLE IF NOT EXISTS public.coach_global_hours (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week     INT         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME        NOT NULL DEFAULT '07:00',
  end_time        TIME        NOT NULL DEFAULT '20:00',
  is_closed       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, day_of_week)
);

ALTER TABLE public.coach_global_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own global hours"
  ON public.coach_global_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view global hours"
  ON public.coach_global_hours FOR SELECT
  USING (true);

-- coach_facility_hours: fixed facility teaching windows
CREATE TABLE IF NOT EXISTS public.coach_facility_hours (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_name     TEXT        NOT NULL,
  facility_address  TEXT,
  court_type        TEXT,
  days_of_week      INT[]       NOT NULL DEFAULT '{}',
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  publicly_bookable BOOLEAN     NOT NULL DEFAULT true,
  notes             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_facility_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own facility hours"
  ON public.coach_facility_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view public facility hours"
  ON public.coach_facility_hours FOR SELECT
  USING (publicly_bookable = true OR coach_id = auth.uid());

-- coach_travel_hours: travel availability windows
-- travel_base_address is intentionally NOT stored here (privacy);
-- use coaches.home_base or a private field on profiles instead.
CREATE TABLE IF NOT EXISTS public.coach_travel_hours (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_radius_miles INT,
  areas_served      TEXT[]      DEFAULT '{}',
  days_of_week      INT[]       NOT NULL DEFAULT '{}',
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  publicly_bookable BOOLEAN     NOT NULL DEFAULT true,
  travel_notes      TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_travel_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own travel hours"
  ON public.coach_travel_hours FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view public travel hours"
  ON public.coach_travel_hours FOR SELECT
  USING (publicly_bookable = true OR coach_id = auth.uid());

-- coach_blockouts: time-based blockouts (lunch, personal, etc.)
-- Separate from coach_unavailability which handles date-range vacation/tournament blocks.
-- Recurring: set days_of_week + start_time + end_time, leave specific_date null.
-- Date-specific: set specific_date + start_time + end_time, leave days_of_week null.
CREATE TABLE IF NOT EXISTS public.coach_blockouts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN (
                   'lunch','personal','tournament','vacation',
                   'facility_unavailable','travel_time','other')),
  title          TEXT,
  days_of_week   INT[]       DEFAULT NULL,
  start_time     TIME,
  end_time       TIME,
  specific_date  DATE        DEFAULT NULL,
  visibility     TEXT        NOT NULL DEFAULT 'private'
                   CHECK (visibility IN ('private','show_as_unavailable')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_blockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own blockouts"
  ON public.coach_blockouts FOR ALL
  USING (coach_id = auth.uid());
```

- [ ] **Apply the migration to Supabase**

```bash
npx supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Commit**

```bash
git add supabase/migrations/20260609120000_coach_schedule_control_panel.sql
git commit -m "feat(db): add coach_global_hours, facility_hours, travel_hours, blockouts tables"
```

---

## Task 2: Hooks — useCoachGlobalHours, useCoachFacilityHours, useCoachTravelHours, useCoachBlockouts

**Files:**
- Create: `src/hooks/useCoachGlobalHours.ts`
- Create: `src/hooks/useCoachFacilityHours.ts`
- Create: `src/hooks/useCoachTravelHours.ts`
- Create: `src/hooks/useCoachBlockouts.ts`

- [ ] **Create `src/hooks/useCoachGlobalHours.ts`:**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachGlobalHour {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export function useCoachGlobalHours(coachId: string | null) {
  const [hours, setHours] = useState<CoachGlobalHour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    const { data } = await supabase
      .from('coach_global_hours')
      .select('*')
      .eq('coach_id', coachId)
      .order('day_of_week');
    setHours((data ?? []) as CoachGlobalHour[]);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  async function upsertDay(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    isClosed: boolean,
  ) {
    if (!coachId) return;
    await supabase.from('coach_global_hours').upsert(
      { coach_id: coachId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_closed: isClosed },
      { onConflict: 'coach_id,day_of_week' },
    );
    await load();
  }

  return { hours, loading, upsertDay, refresh: load };
}
```

- [ ] **Create `src/hooks/useCoachFacilityHours.ts`:**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachFacilityHour {
  id: string;
  coach_id: string;
  facility_name: string;
  facility_address: string | null;
  court_type: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  publicly_bookable: boolean;
  notes: string | null;
  is_active: boolean;
}

export type CoachFacilityHourInput = Omit<CoachFacilityHour, 'id' | 'coach_id' | 'is_active'>;

export function useCoachFacilityHours(coachId: string | null) {
  const [records, setRecords] = useState<CoachFacilityHour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    const { data } = await supabase
      .from('coach_facility_hours')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('created_at');
    setRecords((data ?? []) as CoachFacilityHour[]);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  async function addRecord(input: CoachFacilityHourInput) {
    if (!coachId) return;
    await supabase.from('coach_facility_hours').insert({ ...input, coach_id: coachId, is_active: true });
    await load();
  }

  async function updateRecord(id: string, updates: Partial<CoachFacilityHourInput>) {
    await supabase.from('coach_facility_hours').update(updates).eq('id', id);
    await load();
  }

  async function deleteRecord(id: string) {
    await supabase.from('coach_facility_hours').update({ is_active: false }).eq('id', id);
    await load();
  }

  return { records, loading, addRecord, updateRecord, deleteRecord, refresh: load };
}
```

- [ ] **Create `src/hooks/useCoachTravelHours.ts`:**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachTravelHour {
  id: string;
  coach_id: string;
  travel_radius_miles: number | null;
  areas_served: string[];
  days_of_week: number[];
  start_time: string;
  end_time: string;
  publicly_bookable: boolean;
  travel_notes: string | null;
  is_active: boolean;
}

export type CoachTravelHourInput = Omit<CoachTravelHour, 'id' | 'coach_id' | 'is_active'>;

export function useCoachTravelHours(coachId: string | null) {
  const [records, setRecords] = useState<CoachTravelHour[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    const { data } = await supabase
      .from('coach_travel_hours')
      .select('*')
      .eq('coach_id', coachId)
      .eq('is_active', true)
      .order('created_at');
    setRecords((data ?? []) as CoachTravelHour[]);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  async function addRecord(input: CoachTravelHourInput) {
    if (!coachId) return;
    await supabase.from('coach_travel_hours').insert({ ...input, coach_id: coachId, is_active: true });
    await load();
  }

  async function updateRecord(id: string, updates: Partial<CoachTravelHourInput>) {
    await supabase.from('coach_travel_hours').update(updates).eq('id', id);
    await load();
  }

  async function deleteRecord(id: string) {
    await supabase.from('coach_travel_hours').update({ is_active: false }).eq('id', id);
    await load();
  }

  return { records, loading, addRecord, updateRecord, deleteRecord, refresh: load };
}
```

- [ ] **Create `src/hooks/useCoachBlockouts.ts`:**

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CoachBlockout {
  id: string;
  coach_id: string;
  type: 'lunch' | 'personal' | 'tournament' | 'vacation' | 'facility_unavailable' | 'travel_time' | 'other';
  title: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  specific_date: string | null;
  visibility: 'private' | 'show_as_unavailable';
}

export type CoachBlockoutInput = Omit<CoachBlockout, 'id' | 'coach_id'>;

export function useCoachBlockouts(coachId: string | null) {
  const [blockouts, setBlockouts] = useState<CoachBlockout[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    const { data } = await supabase
      .from('coach_blockouts')
      .select('*')
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });
    setBlockouts((data ?? []) as CoachBlockout[]);
    setLoading(false);
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  async function addBlockout(input: CoachBlockoutInput) {
    if (!coachId) return;
    await supabase.from('coach_blockouts').insert({ ...input, coach_id: coachId });
    await load();
  }

  async function deleteBlockout(id: string) {
    await supabase.from('coach_blockouts').delete().eq('id', id);
    await load();
  }

  return { blockouts, loading, addBlockout, deleteBlockout, refresh: load };
}
```

- [ ] **Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors in the four new hook files.

- [ ] **Commit**

```bash
git add src/hooks/useCoachGlobalHours.ts src/hooks/useCoachFacilityHours.ts src/hooks/useCoachTravelHours.ts src/hooks/useCoachBlockouts.ts
git commit -m "feat(hooks): add schedule control panel hooks for global/facility/travel hours and blockouts"
```

---

## Task 3: SectionCard shared component

**Files:**
- Create: `src/components/coach/schedule/SectionCard.tsx`

- [ ] **Create `src/components/coach/schedule/SectionCard.tsx`:**

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface Props {
  eyebrow: string;
  description?: string;
  children: ReactNode;
  rightAction?: ReactNode;
}

export function SectionCard({ eyebrow, description, children, rightAction }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
        {rightAction}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.pagePx,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerLeft: { flex: 1, gap: 4 },
    eyebrow: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    description: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    body: { gap: 8 },
  }), [theme]);
}
```

---

## Task 4: GlobalHoursSection

**Files:**
- Create: `src/components/coach/schedule/GlobalHoursSection.tsx`

Shared time constants used across all section components — define once here and import in later tasks:

```ts
// shared within this file and copy-pasted into FacilityHoursSection + TravelHoursSection
const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
];

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${period}`;
}
```

- [ ] **Create `src/components/coach/schedule/GlobalHoursSection.tsx`:**

```tsx
import { useMemo, useState } from 'react';
import {
  Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useCoachGlobalHours } from '@/hooks/useCoachGlobalHours';
import { SectionCard } from './SectionCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${period}`;
}

interface Props { coachId: string }

export function GlobalHoursSection({ coachId }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const insets    = useSafeAreaInsets();
  const { hours, upsertDay } = useCoachGlobalHours(coachId);

  const [editDow,    setEditDow]    = useState<number | null>(null);
  const [draftStart, setDraftStart] = useState('07:00');
  const [draftEnd,   setDraftEnd]   = useState('20:00');
  const [draftClosed,setDraftClosed]= useState(false);
  const [saving,     setSaving]     = useState(false);

  function openEdit(dow: number) {
    const rec = hours.find(h => h.day_of_week === dow);
    setDraftStart(rec?.start_time?.slice(0,5) ?? '07:00');
    setDraftEnd(rec?.end_time?.slice(0,5)   ?? '20:00');
    setDraftClosed(rec?.is_closed ?? false);
    setEditDow(dow);
  }

  async function handleSave() {
    if (editDow == null) return;
    setSaving(true);
    await upsertDay(editDow, draftStart, draftEnd, draftClosed);
    setSaving(false);
    setEditDow(null);
  }

  return (
    <SectionCard
      eyebrow="GLOBAL COACHING HOURS"
      description="Outer boundaries — not shown to players, just limits all other layers.">
      {[0,1,2,3,4,5,6].map(dow => {
        const rec = hours.find(h => h.day_of_week === dow);
        return (
          <TouchableOpacity
            key={dow}
            style={styles.dayRow}
            onPress={() => openEdit(dow)}
            activeOpacity={0.7}>
            <Text style={styles.dayLabel}>{DAY_LABELS[dow]}</Text>
            {rec?.is_closed ? (
              <Text style={styles.closedBadge}>Closed</Text>
            ) : rec ? (
              <Text style={styles.timeRange}>
                {fmtTime(rec.start_time)} – {fmtTime(rec.end_time)}
              </Text>
            ) : (
              <Text style={styles.notSet}>Not set</Text>
            )}
            <ChevronRight size={14} color={theme.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        );
      })}

      <Modal
        visible={editDow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditDow(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEditDow(null)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {editDow !== null ? DAY_FULL[editDow] : ''}
          </Text>

          <View style={styles.closedRow}>
            <Text style={styles.closedLabel}>Closed / Unavailable</Text>
            <Switch
              value={draftClosed}
              onValueChange={setDraftClosed}
              trackColor={{ false: theme.border, true: Colors.blue }}
            />
          </View>

          {!draftClosed && (
            <>
              <Text style={styles.fieldLabel}>START TIME</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TIME_OPTIONS.filter(t => t < draftEnd).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, draftStart === t && styles.chipActive]}
                    onPress={() => setDraftStart(t)}
                    activeOpacity={0.7}>
                    <Text style={[styles.chipText, draftStart === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>END TIME</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TIME_OPTIONS.filter(t => t > draftStart).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, draftEnd === t && styles.chipActive]}
                    onPress={() => setDraftEnd(t)}
                    activeOpacity={0.7}>
                    <Text style={[styles.chipText, draftEnd === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    dayLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      width: 36,
    },
    timeRange: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textPrimary,
    },
    closedBadge: {
      flex: 1,
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.1,
    },
    notSet: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      fontStyle: 'italic',
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      borderTopWidth: 1, borderColor: theme.border,
      paddingHorizontal: Spacing.pagePx, paddingTop: 12, gap: 10,
    },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    closedRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingVertical: 4,
    },
    closedLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
      marginTop: 4,
    },
    chipRow: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { borderColor: Colors.blue, backgroundColor: 'rgba(45,107,255,0.15)' },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipTextActive: { color: Colors.blue },
    saveBtn: {
      backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: '#FFFFFF',
    },
  }), [theme]);
}
```

---

## Task 5: FacilityHoursSection

**Files:**
- Create: `src/components/coach/schedule/FacilityHoursSection.tsx`

- [ ] **Create `src/components/coach/schedule/FacilityHoursSection.tsx`:**

```tsx
import { useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, Globe, Lock } from 'lucide-react-native';
import { useCoachFacilityHours, type CoachFacilityHourInput } from '@/hooks/useCoachFacilityHours';
import { SectionCard } from './SectionCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
];
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const COURT_TYPES = ['Hard','Clay','Grass','Indoor','Carpet'];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${period}`;
}

function fmtDays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  return days.map(d => DAY_LABELS[d]).join(', ');
}

const EMPTY_INPUT: CoachFacilityHourInput = {
  facility_name: '',
  facility_address: null,
  court_type: null,
  days_of_week: [],
  start_time: '08:00',
  end_time: '12:00',
  publicly_bookable: true,
  notes: null,
};

interface Props { coachId: string }

export function FacilityHoursSection({ coachId }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const insets    = useSafeAreaInsets();
  const { records, addRecord, deleteRecord } = useCoachFacilityHours(coachId);

  const [showSheet, setShowSheet] = useState(false);
  const [draft, setDraft]         = useState<CoachFacilityHourInput>(EMPTY_INPUT);
  const [saving, setSaving]       = useState(false);

  function openAdd() {
    setDraft(EMPTY_INPUT);
    setShowSheet(true);
  }

  function toggleDay(dow: number) {
    setDraft(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dow)
        ? prev.days_of_week.filter(d => d !== dow)
        : [...prev.days_of_week, dow].sort(),
    }));
  }

  async function handleAdd() {
    if (!draft.facility_name.trim()) {
      Alert.alert('Missing info', 'Facility name is required.');
      return;
    }
    if (draft.days_of_week.length === 0) {
      Alert.alert('Missing info', 'Select at least one day.');
      return;
    }
    setSaving(true);
    await addRecord(draft);
    setSaving(false);
    setShowSheet(false);
  }

  function handleDelete(id: string, name: string) {
    Alert.alert('Remove Facility Hours', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteRecord(id) },
    ]);
  }

  return (
    <SectionCard
      eyebrow="FACILITY HOURS"
      description="Fixed sessions at a specific venue."
      rightAction={
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
          <Plus size={14} color={Colors.blue} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      }>
      {records.length === 0 && (
        <Text style={styles.emptyText}>No facility hours set. Tap Add to create one.</Text>
      )}
      {records.map(rec => (
        <View key={rec.id} style={styles.recordRow}>
          <View style={styles.recordInfo}>
            <View style={styles.recordTitle}>
              <Text style={styles.facilityName}>{rec.facility_name}</Text>
              {rec.publicly_bookable
                ? <Globe size={12} color={Colors.cyan} strokeWidth={2} />
                : <Lock size={12} color={theme.textMuted} strokeWidth={2} />}
            </View>
            <Text style={styles.recordMeta}>
              {fmtDays(rec.days_of_week)}  ·  {fmtTime(rec.start_time)} – {fmtTime(rec.end_time)}
            </Text>
            {rec.court_type && (
              <Text style={styles.courtType}>{rec.court_type}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(rec.id, rec.facility_name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}>
            <Trash2 size={15} color={Colors.negative} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      ))}

      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSheet(false)} />
        <ScrollView
          style={[styles.sheet, { maxHeight: '85%' }]}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add Facility Hours</Text>

          <Text style={styles.fieldLabel}>FACILITY NAME *</Text>
          <TextInput
            style={styles.textInput}
            value={draft.facility_name}
            onChangeText={v => setDraft(p => ({ ...p, facility_name: v }))}
            placeholder="e.g. Riverside Tennis Club"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.textInput}
            value={draft.facility_address ?? ''}
            onChangeText={v => setDraft(p => ({ ...p, facility_address: v || null }))}
            placeholder="Street address"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.fieldLabel}>COURT TYPE</Text>
          <View style={styles.chipRowWrap}>
            {COURT_TYPES.map(ct => (
              <TouchableOpacity
                key={ct}
                style={[styles.chip, draft.court_type === ct && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, court_type: p.court_type === ct ? null : ct }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.court_type === ct && styles.chipTextActive]}>{ct}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>DAYS *</Text>
          <View style={styles.chipRowWrap}>
            {[0,1,2,3,4,5,6].map(dow => (
              <TouchableOpacity
                key={dow}
                style={[styles.chip, draft.days_of_week.includes(dow) && styles.chipActive]}
                onPress={() => toggleDay(dow)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.days_of_week.includes(dow) && styles.chipTextActive]}>
                  {DAY_LABELS[dow]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>START TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t < draft.end_time).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.start_time === t && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, start_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.start_time === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>END TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t > draft.start_time).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.end_time === t && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, end_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.end_time === t && styles.chipTextActive]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Publicly Bookable</Text>
              <Text style={styles.toggleSub}>Players can see and request this slot</Text>
            </View>
            <Switch
              value={draft.publicly_bookable}
              onValueChange={v => setDraft(p => ({ ...p, publicly_bookable: v }))}
              trackColor={{ false: theme.border, true: Colors.blue }}
            />
          </View>

          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={draft.notes ?? ''}
            onChangeText={v => setDraft(p => ({ ...p, notes: v || null }))}
            placeholder="Optional notes"
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add Facility Hours'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.sm, borderWidth: 1,
      borderColor: 'rgba(45,107,255,0.35)',
      backgroundColor: 'rgba(45,107,255,0.08)',
    },
    addBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: Colors.blue,
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted,
      textAlign: 'center', paddingVertical: 8, fontStyle: 'italic',
    },
    recordRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8,
    },
    recordInfo: { flex: 1, gap: 3 },
    recordTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    facilityName: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: theme.textPrimary,
    },
    recordMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    courtType: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow, color: Colors.blue,
      letterSpacing: 0.1,
    },
    deleteBtn: { padding: 4, marginTop: 2 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      borderTopWidth: 1, borderColor: theme.border,
    },
    sheetContent: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, gap: 10 },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle, color: theme.textPrimary, letterSpacing: -0.2,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow, color: theme.textMuted,
      letterSpacing: 0.18, marginTop: 4,
    },
    textInput: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
      color: theme.textPrimary, backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: theme.border, borderRadius: Radius.sm,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    textArea: { minHeight: 72, textAlignVertical: 'top' },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chipRowH: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { borderColor: Colors.blue, backgroundColor: 'rgba(45,107,255,0.15)' },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    chipTextActive: { color: Colors.blue },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingVertical: 4,
    },
    toggleInfo: { flex: 1, gap: 2 },
    toggleLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: theme.textSecondary,
    },
    toggleSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted,
    },
    saveBtn: {
      backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: '#FFFFFF',
    },
  }), [theme]);
}
```

---

## Task 6: TravelHoursSection

**Files:**
- Create: `src/components/coach/schedule/TravelHoursSection.tsx`

- [ ] **Create `src/components/coach/schedule/TravelHoursSection.tsx`:**

```tsx
import { useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, Globe, Lock } from 'lucide-react-native';
import { useCoachTravelHours, type CoachTravelHourInput } from '@/hooks/useCoachTravelHours';
import { SectionCard } from './SectionCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${period}`;
}

function fmtDays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  return days.map(d => DAY_LABELS[d]).join(', ');
}

const EMPTY_INPUT: CoachTravelHourInput = {
  travel_radius_miles: null,
  areas_served: [],
  days_of_week: [],
  start_time: '14:00',
  end_time: '19:00',
  publicly_bookable: true,
  travel_notes: null,
};

interface Props { coachId: string }

export function TravelHoursSection({ coachId }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const insets    = useSafeAreaInsets();
  const { records, addRecord, deleteRecord } = useCoachTravelHours(coachId);

  const [showSheet,   setShowSheet]   = useState(false);
  const [draft,       setDraft]       = useState<CoachTravelHourInput>(EMPTY_INPUT);
  const [areasInput,  setAreasInput]  = useState('');
  const [saving,      setSaving]      = useState(false);

  function openAdd() {
    setDraft(EMPTY_INPUT);
    setAreasInput('');
    setShowSheet(true);
  }

  function toggleDay(dow: number) {
    setDraft(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dow)
        ? prev.days_of_week.filter(d => d !== dow)
        : [...prev.days_of_week, dow].sort(),
    }));
  }

  async function handleAdd() {
    if (draft.days_of_week.length === 0) {
      Alert.alert('Missing info', 'Select at least one day.');
      return;
    }
    const areas = areasInput.split(',').map(a => a.trim()).filter(Boolean);
    setSaving(true);
    await addRecord({ ...draft, areas_served: areas });
    setSaving(false);
    setShowSheet(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Remove Travel Availability', 'Remove this travel window?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteRecord(id) },
    ]);
  }

  return (
    <SectionCard
      eyebrow="TRAVEL AVAILABILITY"
      description="Hours when you travel to students."
      rightAction={
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
          <Plus size={14} color={Colors.volt} strokeWidth={2.5} />
          <Text style={[styles.addBtnText, { color: Colors.volt }]}>Add</Text>
        </TouchableOpacity>
      }>
      {records.length === 0 && (
        <Text style={styles.emptyText}>No travel windows set. Tap Add to create one.</Text>
      )}
      {records.map(rec => (
        <View key={rec.id} style={styles.recordRow}>
          <View style={styles.recordInfo}>
            <View style={styles.recordTitle}>
              <Text style={styles.travelLabel}>Travel</Text>
              {rec.publicly_bookable
                ? <Globe size={12} color={Colors.cyan} strokeWidth={2} />
                : <Lock size={12} color={theme.textMuted} strokeWidth={2} />}
            </View>
            <Text style={styles.recordMeta}>
              {fmtDays(rec.days_of_week)}  ·  {fmtTime(rec.start_time)} – {fmtTime(rec.end_time)}
            </Text>
            {rec.travel_radius_miles != null && (
              <Text style={styles.radiusText}>{rec.travel_radius_miles} mi radius</Text>
            )}
            {rec.areas_served.length > 0 && (
              <Text style={styles.areasText}>{rec.areas_served.join(' · ')}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(rec.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}>
            <Trash2 size={15} color={Colors.negative} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      ))}

      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSheet(false)} />
        <ScrollView
          style={[styles.sheet, { maxHeight: '85%' }]}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add Travel Availability</Text>

          <Text style={styles.fieldLabel}>DAYS *</Text>
          <View style={styles.chipRowWrap}>
            {[0,1,2,3,4,5,6].map(dow => (
              <TouchableOpacity
                key={dow}
                style={[styles.chip, draft.days_of_week.includes(dow) && styles.chipActiveVolt]}
                onPress={() => toggleDay(dow)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.days_of_week.includes(dow) && styles.chipTextVolt]}>
                  {DAY_LABELS[dow]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>START TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t < draft.end_time).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.start_time === t && styles.chipActiveVolt]}
                onPress={() => setDraft(p => ({ ...p, start_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.start_time === t && styles.chipTextVolt]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>END TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t > draft.start_time).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.end_time === t && styles.chipActiveVolt]}
                onPress={() => setDraft(p => ({ ...p, end_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.end_time === t && styles.chipTextVolt]}>{fmtTime(t)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>TRAVEL RADIUS (MILES)</Text>
          <TextInput
            style={styles.textInput}
            value={draft.travel_radius_miles?.toString() ?? ''}
            onChangeText={v => setDraft(p => ({ ...p, travel_radius_miles: v ? parseInt(v, 10) : null }))}
            placeholder="e.g. 10"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>AREAS SERVED</Text>
          <TextInput
            style={styles.textInput}
            value={areasInput}
            onChangeText={setAreasInput}
            placeholder="Dorado, San Juan, Guaynabo"
            placeholderTextColor={theme.textMuted}
          />
          <Text style={styles.helperText}>Comma-separated list of areas</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Publicly Bookable</Text>
              <Text style={styles.toggleSub}>Players can see and request this window</Text>
            </View>
            <Switch
              value={draft.publicly_bookable}
              onValueChange={v => setDraft(p => ({ ...p, publicly_bookable: v }))}
              trackColor={{ false: theme.border, true: Colors.blue }}
            />
          </View>

          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={draft.travel_notes ?? ''}
            onChangeText={v => setDraft(p => ({ ...p, travel_notes: v || null }))}
            placeholder="Optional notes for students"
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add Travel Window'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.sm, borderWidth: 1,
      borderColor: 'rgba(214,255,61,0.35)',
      backgroundColor: 'rgba(214,255,61,0.08)',
    },
    addBtnText: {
      fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label,
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted,
      textAlign: 'center', paddingVertical: 8, fontStyle: 'italic',
    },
    recordRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8,
    },
    recordInfo: { flex: 1, gap: 3 },
    recordTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    travelLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: Colors.volt,
    },
    recordMeta: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    radiusText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow, color: theme.textMuted, letterSpacing: 0.1,
    },
    areasText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted,
    },
    deleteBtn: { padding: 4, marginTop: 2 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      borderTopWidth: 1, borderColor: theme.border,
    },
    sheetContent: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, gap: 10 },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle, color: theme.textPrimary, letterSpacing: -0.2,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow, color: theme.textMuted,
      letterSpacing: 0.18, marginTop: 4,
    },
    textInput: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body,
      color: theme.textPrimary, backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: theme.border, borderRadius: Radius.sm,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    textArea: { minHeight: 72, textAlignVertical: 'top' },
    helperText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted, fontStyle: 'italic',
    },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chipRowH: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border,
    },
    chipActiveVolt: { borderColor: Colors.volt, backgroundColor: 'rgba(214,255,61,0.12)' },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    chipTextVolt: { color: Colors.volt },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', paddingVertical: 4,
    },
    toggleInfo: { flex: 1, gap: 2 },
    toggleLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: theme.textSecondary,
    },
    toggleSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted,
    },
    saveBtn: {
      backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: '#FFFFFF',
    },
  }), [theme]);
}
```

---

## Task 7: BlockoutsSection + ScheduleColorKey

**Files:**
- Create: `src/components/coach/schedule/BlockoutsSection.tsx`
- Create: `src/components/coach/schedule/ScheduleColorKey.tsx`

- [ ] **Create `src/components/coach/schedule/BlockoutsSection.tsx`:**

```tsx
import { useMemo, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2 } from 'lucide-react-native';
import { useCoachBlockouts, type CoachBlockoutInput } from '@/hooks/useCoachBlockouts';
import { SectionCard } from './SectionCard';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const BLOCKOUT_TYPES: Array<{ value: CoachBlockoutInput['type']; label: string }> = [
  { value: 'lunch',               label: 'Lunch'              },
  { value: 'personal',            label: 'Personal'           },
  { value: 'tournament',          label: 'Tournament'         },
  { value: 'vacation',            label: 'Vacation'           },
  { value: 'facility_unavailable',label: 'Facility Unavailable'},
  { value: 'travel_time',         label: 'Travel Time'        },
  { value: 'other',               label: 'Other'              },
];
const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00',
];

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2,'0')}` : ''}${period}`;
}

const EMPTY: CoachBlockoutInput = {
  type: 'lunch',
  title: null,
  days_of_week: [1,2,3,4,5],
  start_time: '12:00',
  end_time: '13:00',
  specific_date: null,
  visibility: 'private',
};

interface Props { coachId: string }

export function BlockoutsSection({ coachId }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const insets    = useSafeAreaInsets();
  const { blockouts, addBlockout, deleteBlockout } = useCoachBlockouts(coachId);

  const [showSheet, setShowSheet] = useState(false);
  const [draft,     setDraft]     = useState<CoachBlockoutInput>(EMPTY);
  const [saving,    setSaving]    = useState(false);

  function openAdd() { setDraft(EMPTY); setShowSheet(true); }

  function toggleDay(dow: number) {
    setDraft(prev => ({
      ...prev,
      days_of_week: (prev.days_of_week ?? []).includes(dow)
        ? (prev.days_of_week ?? []).filter(d => d !== dow)
        : [...(prev.days_of_week ?? []), dow].sort(),
    }));
  }

  async function handleAdd() {
    setSaving(true);
    await addBlockout(draft);
    setSaving(false);
    setShowSheet(false);
  }

  function handleDelete(id: string) {
    Alert.alert('Remove Blockout', 'Remove this blockout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteBlockout(id) },
    ]);
  }

  function blockoutLabel(b: CoachBlockoutInput & { id?: string }): string {
    const typeName = BLOCKOUT_TYPES.find(t => t.value === b.type)?.label ?? b.type;
    if (b.days_of_week && b.days_of_week.length > 0 && b.start_time) {
      const days = b.days_of_week.map(d => DAY_LABELS[d]).join(', ');
      return `${typeName} · ${days} · ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`;
    }
    if (b.specific_date) {
      return `${typeName} · ${b.specific_date}`;
    }
    return typeName;
  }

  return (
    <SectionCard
      eyebrow="BLOCKOUTS"
      description="Override availability for breaks, tournaments, and personal time."
      rightAction={
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
          <Plus size={14} color={theme.textSecondary} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      }>
      {blockouts.length === 0 && (
        <Text style={styles.emptyText}>No blockouts set.</Text>
      )}
      {blockouts.map(b => (
        <View key={b.id} style={styles.row}>
          <View style={styles.dot} />
          <Text style={styles.rowText}>{blockoutLabel(b)}</Text>
          <TouchableOpacity
            onPress={() => handleDelete(b.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}>
            <Trash2 size={14} color={Colors.negative} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      ))}

      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSheet(false)} />
        <ScrollView
          style={[styles.sheet, { maxHeight: '80%' }]}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add Blockout</Text>

          <Text style={styles.fieldLabel}>TYPE</Text>
          <View style={styles.chipRowWrap}>
            {BLOCKOUT_TYPES.map(bt => (
              <TouchableOpacity
                key={bt.value}
                style={[styles.chip, draft.type === bt.value && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, type: bt.value }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.type === bt.value && styles.chipTextActive]}>
                  {bt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>DAYS (RECURRING)</Text>
          <View style={styles.chipRowWrap}>
            {[0,1,2,3,4,5,6].map(dow => (
              <TouchableOpacity
                key={dow}
                style={[styles.chip, (draft.days_of_week ?? []).includes(dow) && styles.chipActive]}
                onPress={() => toggleDay(dow)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, (draft.days_of_week ?? []).includes(dow) && styles.chipTextActive]}>
                  {DAY_LABELS[dow]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>START TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t < (draft.end_time ?? '21:00')).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.start_time === t && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, start_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.start_time === t && styles.chipTextActive]}>
                  {fmtTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>END TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowH}>
            {TIME_OPTIONS.filter(t => t > (draft.start_time ?? '06:00')).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, draft.end_time === t && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, end_time: t }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.end_time === t && styles.chipTextActive]}>
                  {fmtTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>VISIBILITY</Text>
          <View style={styles.chipRowWrap}>
            {[
              { value: 'private',            label: 'Private'          },
              { value: 'show_as_unavailable', label: 'Show as Unavailable' },
            ].map(v => (
              <TouchableOpacity
                key={v.value}
                style={[styles.chip, draft.visibility === v.value && styles.chipActive]}
                onPress={() => setDraft(p => ({ ...p, visibility: v.value as CoachBlockoutInput['visibility'] }))}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, draft.visibility === v.value && styles.chipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Add Blockout'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.sm, borderWidth: 1, borderColor: theme.border,
    },
    addBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textMuted, fontStyle: 'italic',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    dot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: 'rgba(90,99,121,0.80)',
    },
    rowText: {
      flex: 1, fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      borderTopWidth: 1, borderColor: theme.border,
    },
    sheetContent: { paddingHorizontal: Spacing.pagePx, paddingTop: 12, gap: 10 },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle, color: theme.textPrimary, letterSpacing: -0.2,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow, color: theme.textMuted,
      letterSpacing: 0.18, marginTop: 4,
    },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chipRowH: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border,
    },
    chipActive: { borderColor: Colors.blue, backgroundColor: 'rgba(45,107,255,0.15)' },
    chipText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
    chipTextActive: { color: Colors.blue },
    saveBtn: {
      backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 15, alignItems: 'center', marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body, color: '#FFFFFF',
    },
  }), [theme]);
}
```

- [ ] **Create `src/components/coach/schedule/ScheduleColorKey.tsx`:**

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SectionCard } from './SectionCard';
import { Colors, FontFamily, FontSize } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const KEY_ENTRIES = [
  { color: 'rgba(45,107,255,0.70)',  border: 'rgba(45,107,255,0.90)',  label: 'F', name: 'Facility Hours'     },
  { color: 'rgba(214,255,61,0.60)',  border: 'rgba(214,255,61,0.85)',  label: 'T', name: 'Travel Hours'       },
  { color: 'rgba(45,224,255,0.50)',  border: 'rgba(45,224,255,0.80)',  label: 'E', name: 'Either / Flexible'  },
  { color: 'rgba(90,99,121,0.45)',   border: 'rgba(90,99,121,0.70)',   label: 'B', name: 'Blockout'           },
  { color: 'rgba(12,15,24,0.85)',    border: 'rgba(45,107,255,0.40)',  label: 'L', name: 'Booked Lesson'      },
  { color: 'rgba(255,140,66,0.35)',  border: 'rgba(255,140,66,0.70)',  label: 'P', name: 'Pending Request'    },
] as const;

export function ScheduleColorKey() {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  return (
    <SectionCard eyebrow="SCHEDULE COLOR KEY">
      {KEY_ENTRIES.map(entry => (
        <View key={entry.label} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: entry.color, borderColor: entry.border }]}>
            <Text style={styles.swatchLabel}>{entry.label}</Text>
          </View>
          <Text style={styles.name}>{entry.name}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    swatch: {
      width: 28, height: 28, borderRadius: 6, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    swatchLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10, color: theme.textPrimary,
    },
    name: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label, color: theme.textSecondary,
    },
  }), [theme]);
}
```

---

## Task 8: schedule-settings.tsx screen

**Files:**
- Create: `src/app/(coach)/schedule-settings.tsx`

- [ ] **Create `src/app/(coach)/schedule-settings.tsx`:**

```tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import { GlobalHoursSection }   from '@/components/coach/schedule/GlobalHoursSection';
import { FacilityHoursSection } from '@/components/coach/schedule/FacilityHoursSection';
import { TravelHoursSection }   from '@/components/coach/schedule/TravelHoursSection';
import { BlockoutsSection }     from '@/components/coach/schedule/BlockoutsSection';
import { ScheduleColorKey }     from '@/components/coach/schedule/ScheduleColorKey';

export default function ScheduleSettingsScreen() {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const [coachId, setCoachId] = useState<string | null>(null);

  useMemo(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCoachId(user.id);
    });
  }, []);

  if (!coachId) return null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header
        variant="inner"
        title="Schedule Settings"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <GlobalHoursSection   coachId={coachId} />
        <FacilityHoursSection coachId={coachId} />
        <TravelHoursSection   coachId={coachId} />
        <BlockoutsSection     coachId={coachId} />
        <ScheduleColorKey />
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: Spacing.pagePx, paddingBottom: 100, gap: 20 },
  }), [theme]);
}
```

**Note:** Uses `variant="inner"` which is the correct Header variant for pushed screens — it renders a back button via `onBack` and a centered `title`.

---

## Task 9: Update schedule.tsx and _layout.tsx

**Files:**
- Modify: `src/app/(coach)/schedule.tsx`
- Modify: `src/app/(coach)/_layout.tsx`

- [ ] **In `_layout.tsx`, add the hidden schedule-settings route before the closing `</Tabs>` tag:**

Find this line (line 91):
```tsx
      <Tabs.Screen name="reviews" options={{ href: null }} />
```

Add below it:
```tsx
      <Tabs.Screen name="schedule-settings" options={{ href: null }} />
```

- [ ] **In `schedule.tsx`, remove the `CoachAvailabilityGridEditor` import and usage, and add a "Manage Schedule" navigation card.**

Remove this import (line 9):
```tsx
import { CoachAvailabilityGridEditor } from '@/components/coach/CoachAvailabilityGridEditor';
```

Remove this block (lines 87–91):
```tsx
        {/* Availability editor */}
        <CoachAvailabilityGridEditor
          weeklySlots={weeklySlots}
          coachingLocationType={coachProfile?.coachingLocationType ?? null}
          onRefresh={refreshSchedule}
        />
```

Replace with this navigation card after the `CoachWeekView` block:

```tsx
        {/* Schedule settings link */}
        <TouchableOpacity
          style={[styles.manageCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={() => router.push('/(coach)/schedule-settings')}
          activeOpacity={0.85}>
          <View style={styles.manageCardLeft}>
            <Text style={[styles.manageCardTitle, { color: theme.textPrimary }]}>
              Manage Schedule
            </Text>
            <Text style={[styles.manageCardSub, { color: theme.textMuted }]}>
              Global hours · Facility · Travel · Blockouts
            </Text>
          </View>
          <ChevronRight size={18} color={theme.textMuted} strokeWidth={2} />
        </TouchableOpacity>
```

Add these imports to the top of `schedule.tsx`:

```tsx
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
```

(Remove `ChevronLeft` if it was already imported — check the existing imports.)

Add these styles to `useStyles`:

```tsx
    manageCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: Radius.card, borderWidth: 1,
      paddingHorizontal: Spacing.pagePx, paddingVertical: 16, gap: 12,
    },
    manageCardLeft: { flex: 1, gap: 4 },
    manageCardTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle, letterSpacing: -0.2,
    },
    manageCardSub: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
    },
```

Add `Radius` to the design imports in `schedule.tsx` if not already imported.

- [ ] **Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Start dev server and smoke-test**

```bash
npm run dev
```

Verify:
1. Schedule screen shows "Manage Schedule" card instead of the grid editor
2. Tapping "Manage Schedule" navigates to the new screen
3. Schedule Settings screen shows all 5 sections: Global Hours, Facility Hours, Travel, Blockouts, Color Key
4. Global Hours: tapping a day opens a sheet with time pickers; saving updates the row
5. Facility Hours: "Add" button opens sheet; filling name + days + times and saving adds a record
6. Travel: "Add" button opens sheet; fields populate correctly
7. Blockouts: "Add" opens sheet; selecting type + days + times and saving adds blockout
8. Color key renders all 6 entries with correct colors and labels
9. Back button returns to schedule screen
10. Existing week view and lesson display on schedule screen are unaffected

- [ ] **Commit**

```bash
git add src/app/(coach)/schedule-settings.tsx src/app/(coach)/schedule.tsx src/app/(coach)/_layout.tsx src/components/coach/schedule/
git commit -m "feat(schedule): Coach Schedule Control Panel — global hours, facility, travel, blockouts"
```
