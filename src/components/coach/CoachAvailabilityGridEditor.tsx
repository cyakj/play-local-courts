import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import { HOURS, type TimeHour, type CoachAvailabilitySlot, type CellMode } from '@/hooks/useCoachAvailability';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type DraftMap = Map<string, CellMode>;

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

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

  const [draft,  setDraft]  = useState<DraftMap>(() => buildInitialDraft());
  const [saving, setSaving] = useState(false);

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
    const current = draft.get(key);

    if (current == null) {
      setDraft(prev => new Map(prev).set(key, coachDefault));
      return;
    }

    const options    = ['My Facility', 'Traveling', 'Either', 'Remove', 'Cancel'];
    const modeValues: CellMode[] = ['coach_facility', 'traveling', 'both'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 4, destructiveButtonIndex: 3 },
        (idx) => {
          if (idx === 4) return;
          if (idx === 3) { setDraft(prev => { const m = new Map(prev); m.delete(key); return m; }); return; }
          setDraft(prev => new Map(prev).set(key, modeValues[idx]));
        },
      );
    } else {
      Alert.alert(`${DAY_NAMES[dow]} ${hour.label}`, 'Set location:', [
        { text: 'My Facility', onPress: () => setDraft(p => new Map(p).set(key, 'coach_facility')) },
        { text: 'Traveling',   onPress: () => setDraft(p => new Map(p).set(key, 'traveling'))      },
        { text: 'Either',      onPress: () => setDraft(p => new Map(p).set(key, 'both'))            },
        { text: 'Remove', style: 'destructive',
          onPress: () => setDraft(p => { const m = new Map(p); m.delete(key); return m; }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
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
        coach_id: user.id,
        day_of_week: Number(dowStr),
        start_time: hour.start,
        end_time: hour.end,
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
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>WEEKLY AVAILABILITY</Text>
        {isDirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Tap empty cell to add. Tap filled cell to change location or remove.</Text>
      <View style={styles.gridCard}>
        <CoachAvailabilityGrid weeklySlots={[]} getCellMode={getCellMode} onCellPress={handleCellPress} />
        <View style={styles.legend}>
          {[
            { style: styles.dotFacility,  label: 'Facility'  },
            { style: styles.dotTraveling, label: 'Traveling' },
            { style: styles.dotBoth,      label: 'Either'    },
          ].map(({ style, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, style]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow ?? 11,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm ?? 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    btnDisabled: { opacity: 0.5 },
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
      borderRadius: Radius.card ?? 14,
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
    legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
    dotFacility:  { backgroundColor: 'rgba(45,107,255,0.30)', borderColor: 'rgba(45,107,255,0.55)' },
    dotTraveling: { backgroundColor: 'rgba(214,255,61,0.25)', borderColor: 'rgba(214,255,61,0.45)' },
    dotBoth:      { backgroundColor: 'rgba(45,224,255,0.25)', borderColor: 'rgba(45,224,255,0.45)' },
    legendLabel:  { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted },
  }), [theme]);
}
