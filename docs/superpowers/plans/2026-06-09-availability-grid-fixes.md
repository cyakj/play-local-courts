# Availability Grid Interaction Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all interaction bugs in the coach availability grid — local draft state with Save/Cancel buttons, cross-platform bottom-sheet cell editing (replacing ActionSheet/Alert), full color conversion support for all cell modes, and F/T/E text labels on colored cells.

**Architecture:** Two files change. `CoachAvailabilityGrid.tsx` gets (a) the row `TouchableOpacity` replaced with a `View` when in interactive mode to eliminate nested-touch tap failures, and (b) F/T/E text labels rendered inside colored cells. `CoachAvailabilityGridEditor.tsx` is fully rewritten: `ActionSheetIOS`/`Alert` cell handling is replaced with a cross-platform Modal bottom sheet, a Cancel Changes button with confirmation alert is added, and Save/Cancel action bars appear at both top and bottom of the editor.

**Tech Stack:** React Native 0.85, TypeScript, Expo SDK 56, `react-native-safe-area-context`

---

## Files

| Action | File |
|---|---|
| Modify | `src/components/coaching/CoachAvailabilityGrid.tsx` |
| Rewrite | `src/components/coach/CoachAvailabilityGridEditor.tsx` |

---

## Task 1: Fix CoachAvailabilityGrid — row touch propagation + cell labels

**Files:**
- Modify: `src/components/coaching/CoachAvailabilityGrid.tsx`

**Why this fix is needed:** The grid wraps each hour row in a `TouchableOpacity`. When `isCellInteractive` is true, this outer wrapper competes with the inner cell `TouchableOpacity` presses, causing unreliable taps — especially on Android. The fix is to render the row as a plain `View` when in interactive (editor) mode. We also add a tiny F/T/E letter inside each colored cell.

- [ ] **Replace `src/components/coaching/CoachAvailabilityGrid.tsx` with this complete content:**

```tsx
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import {
  HOURS,
  type TimeHour,
  type CoachAvailabilitySlot,
  type CoachUnavailabilityBlock,
  type CellMode,
} from '@/hooks/useCoachAvailability';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function normTime(t: string): string { return t.slice(0, 5); }

interface Props {
  weeklySlots: CoachAvailabilitySlot[];
  unavailabilityBlocks?: CoachUnavailabilityBlock[];
  selectedHour?: TimeHour | null;
  onSelectHour?: (hour: TimeHour) => void;
  compact?: boolean;
  getCellMode?: (dow: number, hour: TimeHour) => CellMode | null;
  onCellPress?: (dow: number, hour: TimeHour) => void;
}

export function CoachAvailabilityGrid({
  weeklySlots,
  unavailabilityBlocks = [],
  selectedHour = null,
  onSelectHour,
  compact = false,
  getCellMode,
  onCellPress,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme, compact);
  const isCellInteractive = !!onCellPress;

  const availSet = useMemo(() => {
    const s = new Set<string>();
    for (const slot of weeklySlots) {
      s.add(`${slot.day_of_week}|${normTime(slot.start_time)}`);
    }
    return s;
  }, [weeklySlots]);

  const upcomingBlocks = useMemo(() => {
    if (!unavailabilityBlocks.length) return [];
    const today = new Date();
    return unavailabilityBlocks
      .filter(b => b.recurs_annually || new Date(b.end_date) >= today)
      .slice(0, 3);
  }, [unavailabilityBlocks]);

  if (!weeklySlots.length && !isCellInteractive) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schedule not posted — request any time</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View>
          {/* Day header */}
          <View style={styles.headerRow}>
            <View style={styles.hourLabelCell} />
            {DAYS.map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          {HOURS.map(hour => {
            const isSelected = !isCellInteractive && selectedHour?.start === hour.start;

            const cells = DAYS.map((_, dow) => {
              if (isCellInteractive) {
                const mode = getCellMode?.(dow, hour) ?? null;
                const cellStyle =
                  mode === 'coach_facility' ? styles.cellFacility :
                  mode === 'traveling'      ? styles.cellTraveling :
                  mode === 'both'           ? styles.cellBoth : null;
                const labelChar =
                  mode === 'coach_facility' ? 'F' :
                  mode === 'traveling'      ? 'T' :
                  mode === 'both'           ? 'E' : null;
                const labelStyle =
                  mode === 'coach_facility' ? styles.labelFacility :
                  mode === 'traveling'      ? styles.labelTraveling :
                  mode === 'both'           ? styles.labelBoth : null;
                return (
                  <TouchableOpacity
                    key={dow}
                    activeOpacity={0.7}
                    onPress={() => onCellPress!(dow, hour)}
                    style={[styles.cell, cellStyle, styles.cellInteractive]}>
                    {labelChar !== null && (
                      <Text style={[styles.cellLabel, labelStyle]}>{labelChar}</Text>
                    )}
                  </TouchableOpacity>
                );
              }
              const available = availSet.has(`${dow}|${hour.start}`);
              const cellStyle = available
                ? (isSelected ? styles.cellAvailableSelected : styles.cellAvailable)
                : null;
              return <View key={dow} style={[styles.cell, cellStyle]} />;
            });

            // Interactive mode: plain View row — no competing outer TouchableOpacity
            if (isCellInteractive) {
              return (
                <View key={hour.start} style={styles.hourRow}>
                  <View style={styles.hourLabelCell}>
                    <Text style={styles.hourLabel}>{hour.label}</Text>
                  </View>
                  {cells}
                </View>
              );
            }

            // Non-interactive mode: row is tappable for hour selection
            return (
              <TouchableOpacity
                key={hour.start}
                activeOpacity={onSelectHour ? 0.7 : 1}
                onPress={onSelectHour ? () => onSelectHour(hour) : undefined}
                style={[styles.hourRow, isSelected && styles.hourRowSelected]}>
                <View style={styles.hourLabelCell}>
                  <Text style={[styles.hourLabel, isSelected && styles.hourLabelSelected]}>
                    {hour.label}
                  </Text>
                </View>
                {cells}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {upcomingBlocks.length > 0 && (
        <View style={styles.blocksContainer}>
          {upcomingBlocks.map(block => (
            <View key={block.id} style={styles.blockRow}>
              <Text style={styles.blockDot}>●</Text>
              <Text style={styles.blockText}>
                {block.title ?? 'Away'}{' · '}
                {block.recurs_annually
                  ? `${block.start_date.slice(5)} (annual)`
                  : `${block.start_date}–${block.end_date}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens, compact: boolean) {
  return useMemo(() => StyleSheet.create({
    root: { gap: 8 },
    scroll: { flexGrow: 0 },
    emptyContainer: { paddingVertical: 16, alignItems: 'center' },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
    headerRow: { flexDirection: 'row', marginBottom: 2 },
    hourLabelCell: { width: 48, paddingRight: 4, justifyContent: 'center' },
    dayHeaderCell: { width: compact ? 32 : 36, alignItems: 'center' },
    dayHeaderText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.8,
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: compact ? 1 : 2,
      paddingHorizontal: 2,
      borderRadius: Radius.xs,
      marginBottom: 1,
    },
    hourRowSelected: {
      backgroundColor: 'rgba(45,224,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.30)',
    },
    hourLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    hourLabelSelected: { color: Colors.cyan },
    cell: {
      width: compact ? 32 : 36,
      height: compact ? 16 : 20,
      borderRadius: Radius.xs,
      backgroundColor: 'rgba(154,163,184,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(154,163,184,0.10)',
    },
    cellInteractive: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellAvailable: {
      backgroundColor: 'rgba(45,224,255,0.10)',
      borderColor: 'rgba(45,224,255,0.25)',
    },
    cellAvailableSelected: {
      backgroundColor: 'rgba(45,224,255,0.18)',
      borderColor: Colors.cyan,
    },
    cellFacility: {
      backgroundColor: 'rgba(45,107,255,0.18)',
      borderColor: 'rgba(45,107,255,0.40)',
    },
    cellTraveling: {
      backgroundColor: 'rgba(214,255,61,0.14)',
      borderColor: 'rgba(214,255,61,0.32)',
    },
    cellBoth: {
      backgroundColor: 'rgba(45,224,255,0.14)',
      borderColor: 'rgba(45,224,255,0.32)',
    },
    cellLabel: {
      fontSize: 7,
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      textAlign: 'center',
    },
    labelFacility:  { color: 'rgba(45,107,255,0.95)' },
    labelTraveling: { color: 'rgba(214,255,61,0.95)' },
    labelBoth:      { color: 'rgba(45,224,255,0.95)' },
    blocksContainer: { marginTop: 4, gap: 4 },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    blockDot: { fontFamily: FontFamily.manropeMedium, fontSize: 8, color: Colors.volt },
    blockText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      flex: 1,
    },
  }), [theme, compact]);
}
```

- [ ] **Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `CoachAvailabilityGrid.tsx`.

- [ ] **Commit**

```bash
git add src/components/coaching/CoachAvailabilityGrid.tsx
git commit -m "fix(availability-grid): use View row in interactive mode, add F/T/E cell labels"
```

---

## Task 2: Rewrite CoachAvailabilityGridEditor — bottom sheet, Cancel, dual action bars, toast

**Files:**
- Rewrite: `src/components/coach/CoachAvailabilityGridEditor.tsx`

**What changes:**
- Remove `ActionSheetIOS`, `Platform` imports — replace with a cross-platform `Modal` bottom sheet
- Add `useSafeAreaInsets` for sheet bottom padding
- Sheet has two modes: `'add'` (empty cell) and `'edit'` (filled cell)
- Sheet renders radio-button option list: Facility / Traveling / Either, plus Remove (edit mode only)
- `handleCellPress` now opens the sheet instead of calling ActionSheetIOS/Alert
- `handleSheetConfirm` applies changes locally to the draft
- `handleCancel` shows `Alert.alert` confirmation before restoring `buildInitialDraft()`
- `handleSave` unchanged except it shows a state-based green toast on success
- Action bars (Save + Cancel) render at both top and bottom
- Unsaved changes dot indicator next to section title

- [ ] **Replace `src/components/coach/CoachAvailabilityGridEditor.tsx` with this complete content:**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import { HOURS, type TimeHour, type CoachAvailabilitySlot, type CellMode } from '@/hooks/useCoachAvailability';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type DraftMap = Map<string, CellMode>;
type SheetMode = 'add' | 'edit' | null;
type SheetSelection = CellMode | 'remove';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LOCATION_OPTIONS: { value: CellMode; label: string }[] = [
  { value: 'coach_facility', label: 'Facility'  },
  { value: 'traveling',      label: 'Traveling' },
  { value: 'both',           label: 'Either'    },
];

function makeHourKey(dow: number, hour: TimeHour): string { return `${dow}|${hour.start}`; }
function normTime(t: string): string { return t.slice(0, 5); }

interface Props {
  weeklySlots:          CoachAvailabilitySlot[];
  coachingLocationType: string | null;
  onRefresh:            () => void;
}

export function CoachAvailabilityGridEditor({ weeklySlots, coachingLocationType, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);
  const insets    = useSafeAreaInsets();

  const coachDefault: CellMode =
    coachingLocationType === 'traveling_coach' ? 'traveling' :
    coachingLocationType === 'facility_travel' ? 'both'      : 'coach_facility';

  const buildInitialDraft = useCallback((): DraftMap => {
    const map: DraftMap = new Map();
    for (const slot of weeklySlots) {
      const hour = HOURS.find(h => normTime(slot.start_time) === h.start);
      if (hour) {
        map.set(makeHourKey(slot.day_of_week, hour), (slot.location_mode as CellMode) ?? 'coach_facility');
      }
    }
    return map;
  }, [weeklySlots]);

  const [draft,        setDraft]        = useState<DraftMap>(() => buildInitialDraft());
  const [saving,       setSaving]       = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const [sheetMode,      setSheetMode]      = useState<SheetMode>(null);
  const [sheetTarget,    setSheetTarget]    = useState<{ dow: number; hour: TimeHour } | null>(null);
  const [sheetSelection, setSheetSelection] = useState<SheetSelection>('coach_facility');

  useEffect(() => { setDraft(buildInitialDraft()); }, [buildInitialDraft]);

  const isDirty = useMemo(() => {
    const saved = buildInitialDraft();
    if (saved.size !== draft.size) return true;
    for (const [k, v] of draft) { if (saved.get(k) !== v) return true; }
    return false;
  }, [draft, buildInitialDraft]);

  function getCellMode(dow: number, hour: TimeHour): CellMode | null {
    return draft.get(makeHourKey(dow, hour)) ?? null;
  }

  function handleCellPress(dow: number, hour: TimeHour) {
    const key     = makeHourKey(dow, hour);
    const current = draft.get(key) ?? null;
    setSheetTarget({ dow, hour });
    setSheetSelection(current ?? coachDefault);
    setSheetMode(current == null ? 'add' : 'edit');
  }

  function handleSheetConfirm() {
    if (!sheetTarget) return;
    const key = makeHourKey(sheetTarget.dow, sheetTarget.hour);
    if (sheetSelection === 'remove') {
      setDraft(prev => { const m = new Map(prev); m.delete(key); return m; });
    } else {
      setDraft(prev => new Map(prev).set(key, sheetSelection));
    }
    setSheetMode(null);
  }

  function handleCancel() {
    Alert.alert(
      'Discard Changes',
      'Discard unsaved availability changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setDraft(buildInitialDraft()) },
      ],
    );
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const toDeleteIds = weeklySlots
      .filter(s => {
        const hour = HOURS.find(h => normTime(s.start_time) === h.start);
        return !hour || !draft.has(makeHourKey(s.day_of_week, hour));
      })
      .map(s => s.id);

    const toUpsert = Array.from(draft.entries()).map(([key, mode]) => {
      const [dowStr, hourStart] = key.split('|');
      const hour = HOURS.find(h => h.start === hourStart)!;
      return {
        coach_id:      user.id,
        day_of_week:   Number(dowStr),
        start_time:    hour.start,
        end_time:      hour.end,
        location_mode: mode,
      };
    });

    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('coach_availability').delete().in('id', toDeleteIds);
      }
      if (toUpsert.length > 0) {
        await supabase.from('coach_availability').upsert(toUpsert, {
          onConflict: 'coach_id,day_of_week,start_time',
        });
      }
      onRefresh();
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2200);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const currentSavedMode = sheetTarget
    ? (buildInitialDraft().get(makeHourKey(sheetTarget.dow, sheetTarget.hour)) ?? null)
    : null;
  const savedModeLabel =
    currentSavedMode === 'coach_facility' ? 'Facility' :
    currentSavedMode === 'traveling'      ? 'Traveling' :
    currentSavedMode === 'both'           ? 'Either' : '—';

  // Inline action bar — rendered at both top and bottom
  const actionBar = (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={[styles.cancelBtn, !isDirty && styles.btnDisabled]}
        onPress={handleCancel}
        disabled={!isDirty}
        activeOpacity={0.85}>
        <Text style={styles.cancelBtnText}>Cancel Changes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.saveBtn, (!isDirty || saving) && styles.btnDisabled]}
        onPress={handleSave}
        disabled={!isDirty || saving}
        activeOpacity={0.85}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Section title + dirty indicator */}
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>WEEKLY AVAILABILITY</Text>
        {isDirty && <View style={styles.dirtyDot} />}
      </View>

      {/* Top action bar */}
      {actionBar}

      <Text style={styles.hint}>Tap empty cell to add. Tap filled cell to change or remove.</Text>

      {/* Grid */}
      <View style={styles.gridCard}>
        <CoachAvailabilityGrid
          weeklySlots={[]}
          getCellMode={getCellMode}
          onCellPress={handleCellPress}
        />
        <View style={styles.legend}>
          {([
            { style: styles.dotFacility,  label: 'Facility'  },
            { style: styles.dotTraveling, label: 'Traveling' },
            { style: styles.dotBoth,      label: 'Either'    },
          ] as const).map(({ style, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, style]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom action bar */}
      {actionBar}

      {/* Success toast */}
      {toastVisible && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>Availability saved</Text>
        </View>
      )}

      {/* Cell edit / add bottom sheet */}
      <Modal
        visible={sheetMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetMode(null)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSheetMode(null)}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>
            {sheetMode === 'add' ? 'Add Availability' : 'Edit Time Slot'}
          </Text>

          {sheetTarget && (
            <View style={styles.sheetInfo}>
              <Text style={styles.sheetInfoText}>
                {DAY_NAMES[sheetTarget.dow]}  ·  {sheetTarget.hour.label}
              </Text>
              {sheetMode === 'edit' && (
                <Text style={styles.sheetCurrentType}>Currently: {savedModeLabel}</Text>
              )}
            </View>
          )}

          <View style={styles.optionsList}>
            {LOCATION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, sheetSelection === opt.value && styles.optionRowActive]}
                onPress={() => setSheetSelection(opt.value)}
                activeOpacity={0.7}>
                <View style={[styles.optionRadio, sheetSelection === opt.value && styles.optionRadioActive]} />
                <Text style={[styles.optionLabel, sheetSelection === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            {sheetMode === 'edit' && (
              <TouchableOpacity
                style={[styles.optionRow, sheetSelection === 'remove' && styles.optionRowRemove]}
                onPress={() => setSheetSelection('remove')}
                activeOpacity={0.7}>
                <View style={[styles.optionRadio, sheetSelection === 'remove' && styles.optionRadioRemove]} />
                <Text style={[styles.optionLabel, sheetSelection === 'remove' && styles.optionLabelRemove]}>
                  Remove Availability
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.sheetConfirmBtn,
              sheetSelection === 'remove' && styles.sheetConfirmRemove,
            ]}
            onPress={handleSheetConfirm}
            activeOpacity={0.85}>
            <Text style={styles.sheetConfirmText}>
              {sheetMode === 'add' ? 'Add' : sheetSelection === 'remove' ? 'Remove' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetCancelBtn}
            onPress={() => setSheetMode(null)}
            activeOpacity={0.85}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    dirtyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.volt,
    },

    actionBar: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    cancelBtn: {
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    btnDisabled: { opacity: 0.4 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },

    hint: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      fontStyle: 'italic',
    },

    gridCard: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.cardPadding ?? 20,
      gap: 12,
    },
    legend: {
      flexDirection: 'row',
      gap: 16,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot:  { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
    dotFacility:  { backgroundColor: 'rgba(45,107,255,0.30)', borderColor: 'rgba(45,107,255,0.55)' },
    dotTraveling: { backgroundColor: 'rgba(214,255,61,0.25)', borderColor: 'rgba(214,255,61,0.45)' },
    dotBoth:      { backgroundColor: 'rgba(45,224,255,0.25)', borderColor: 'rgba(45,224,255,0.45)' },
    legendLabel:  { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },

    toast: {
      position: 'absolute',
      bottom: 80,
      alignSelf: 'center',
      backgroundColor: '#2FD98B',
      borderRadius: Radius.pill,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    toastText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.cardBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      gap: 12,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
      letterSpacing: -0.2,
    },
    sheetInfo: { gap: 4 },
    sheetInfoText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    sheetCurrentType: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },

    optionsList: {
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 8,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionRowActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.10)',
    },
    optionRowRemove: {
      borderColor: Colors.negative,
      backgroundColor: 'rgba(255,92,107,0.08)',
    },
    optionRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: theme.textMuted,
    },
    optionRadioActive: {
      borderColor: Colors.blue,
      backgroundColor: Colors.blue,
    },
    optionRadioRemove: {
      borderColor: Colors.negative,
      backgroundColor: Colors.negative,
    },
    optionLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textSecondary,
    },
    optionLabelActive: { color: Colors.blue },
    optionLabelRemove: { color: Colors.negative },

    sheetConfirmBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 4,
    },
    sheetConfirmRemove: {
      backgroundColor: Colors.negative,
    },
    sheetConfirmText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: '#FFFFFF',
    },
    sheetCancelBtn: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    sheetCancelText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: theme.textMuted,
    },
  }), [theme]);
}
```

- [ ] **Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Start dev server and smoke-test manually**

```bash
npm run dev
```

Open the coach schedule screen. Verify:

1. Grid renders — colored cells show F/T/E labels
2. Tapping empty cell opens "Add Availability" bottom sheet with Facility/Traveling/Either options
3. Tapping "Add" closes sheet, cell changes color + label, Save/Cancel bars activate
4. Tapping a colored cell opens "Edit Time Slot" sheet showing current type
5. Changing Traveling → Facility works (cell turns blue with F)
6. Changing Traveling → Either works (cell turns cyan with E)
7. Selecting "Remove Availability" and tapping Remove clears the cell
8. Removing one cell does not clear adjacent cells
9. Cancel Changes button shows Alert confirmation
10. Discarding restores the previous saved state
11. Save Changes posts to Supabase, green toast appears briefly
12. Save and Cancel buttons are disabled (40% opacity) when no changes

- [ ] **Commit**

```bash
git add src/components/coach/CoachAvailabilityGridEditor.tsx
git commit -m "feat(availability-grid): bottom sheet editing, Save/Cancel bars, color conversion fix, toast"
```

---

## QA Checklist (manual verification against spec)

Run on device or simulator after both tasks are merged:

- [ ] Save Changes appears at top and bottom
- [ ] Cancel Changes appears at top and bottom
- [ ] Save disabled (opacity 0.4) when no changes
- [ ] Cancel disabled (opacity 0.4) when no changes
- [ ] Volt dot indicator appears next to "WEEKLY AVAILABILITY" when draft has unsaved changes
- [ ] Tapping empty cell opens Add sheet
- [ ] Add sheet has Facility / Traveling / Either options
- [ ] Tapping Add closes sheet and cell appears colored with label
- [ ] Tapping filled cell opens Edit sheet
- [ ] Edit sheet shows current type in "Currently: X" line
- [ ] Traveling → Facility: cell turns blue, shows F
- [ ] Traveling → Either: cell turns cyan, shows E
- [ ] Traveling → Remove: cell clears to empty
- [ ] Facility → Traveling: cell turns yellow, shows T
- [ ] Facility → Either: cell turns cyan, shows E
- [ ] Either → Facility: cell turns blue, shows F
- [ ] Either → Traveling: cell turns yellow, shows T
- [ ] Removing one slot does not affect adjacent slots
- [ ] Unsaved changes not persisted to Supabase until Save Changes tapped
- [ ] Cancel shows "Discard Changes" confirmation alert
- [ ] Confirming Discard restores grid to last saved state
- [ ] Saving shows green "Availability saved" toast
- [ ] Toast disappears after ~2 seconds
