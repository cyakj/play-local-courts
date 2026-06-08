import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { CoachAvailabilityGrid } from '@/components/coaching/CoachAvailabilityGrid';
import {
  TIME_BANDS,
  type TimeBand,
  type CoachAvailabilitySlot,
  type CellMode,
} from '@/hooks/useCoachAvailability';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type DraftMap = Map<string, CellMode>; // key = `${dow}|${band.label}`

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const LOCATION_OPTIONS: { value: CellMode; label: string }[] = [
  { value: 'coach_facility', label: 'My Facility' },
  { value: 'traveling',      label: 'Traveling'   },
  { value: 'both',           label: 'Either'      },
];

function makeCellKey(dow: number, band: TimeBand): string {
  return `${dow}|${band.label}`;
}

function isBandAligned(slot: CoachAvailabilitySlot): boolean {
  return TIME_BANDS.some(b => b.start === slot.start_time && b.end === slot.end_time);
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12  = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

interface Props {
  weeklySlots:         CoachAvailabilitySlot[];
  defaultLocationMode: string | null;
  onRefresh:           () => void;
}

export function CoachAvailabilityGridEditor({ weeklySlots, defaultLocationMode, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles    = useStyles(theme);

  const coachDefault = (defaultLocationMode as CellMode | null) ?? 'coach_facility';

  const { bandSlots, legacySlots } = useMemo(() => ({
    bandSlots:   weeklySlots.filter(isBandAligned),
    legacySlots: weeklySlots.filter(s => !isBandAligned(s)),
  }), [weeklySlots]);

  const buildInitialDraft = useCallback((): DraftMap => {
    const map: DraftMap = new Map();
    for (const slot of bandSlots) {
      const band = TIME_BANDS.find(b => b.start === slot.start_time)!;
      map.set(makeCellKey(slot.day_of_week, band), (slot.location_mode as CellMode) ?? 'coach_facility');
    }
    return map;
  }, [bandSlots]);

  const [draft,  setDraft]  = useState<DraftMap>(() => buildInitialDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(buildInitialDraft());
  }, [buildInitialDraft]);

  const isDirty = useMemo(() => {
    const saved = buildInitialDraft();
    if (saved.size !== draft.size) return true;
    for (const [k, v] of draft) {
      if (saved.get(k) !== v) return true;
    }
    return false;
  }, [draft, buildInitialDraft]);

  function getCellMode(dow: number, band: TimeBand): CellMode | null {
    return draft.get(makeCellKey(dow, band)) ?? null;
  }

  function handleCellPress(dow: number, band: TimeBand) {
    const key     = makeCellKey(dow, band);
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
          if (idx === 3) {
            setDraft(prev => { const m = new Map(prev); m.delete(key); return m; });
            return;
          }
          setDraft(prev => new Map(prev).set(key, modeValues[idx]));
        },
      );
    } else {
      Alert.alert(
        `${DAY_NAMES[dow]} ${band.label.charAt(0) + band.label.slice(1).toLowerCase()}`,
        'Set location:',
        [
          { text: 'My Facility', onPress: () => setDraft(p => new Map(p).set(key, 'coach_facility')) },
          { text: 'Traveling',   onPress: () => setDraft(p => new Map(p).set(key, 'traveling'))      },
          { text: 'Either',      onPress: () => setDraft(p => new Map(p).set(key, 'both'))            },
          { text: 'Remove', style: 'destructive',
            onPress: () => setDraft(p => { const m = new Map(p); m.delete(key); return m; }) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const toDeleteIds = bandSlots
      .filter(s => {
        const band = TIME_BANDS.find(b => b.start === s.start_time)!;
        return !draft.has(makeCellKey(s.day_of_week, band));
      })
      .map(s => s.id);

    const toUpsert = Array.from(draft.entries()).map(([key, mode]) => {
      const [dowStr, bandLabel] = key.split('|');
      const band = TIME_BANDS.find(b => b.label === bandLabel)!;
      return {
        coach_id:      user.id,
        day_of_week:   Number(dowStr),
        start_time:    band.start,
        end_time:      band.end,
        location_mode: mode,
      };
    });

    try {
      if (toDeleteIds.length > 0) {
        await supabase.from('coach_availability').delete().in('id', toDeleteIds);
      }
      if (toUpsert.length > 0) {
        await supabase
          .from('coach_availability')
          .upsert(toUpsert, { onConflict: 'coach_id,day_of_week,start_time' });
      }
      onRefresh();
    } catch {
      Alert.alert('Error', 'Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLegacy(slotId: string, label: string) {
    Alert.alert('Remove Slot', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('coach_availability').delete().eq('id', slotId);
          onRefresh();
        },
      },
    ]);
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
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.hint}>
        Tap empty cell to add availability. Tap filled cell to change location or remove.
      </Text>

      <View style={styles.gridCard}>
        <CoachAvailabilityGrid
          weeklySlots={[]}
          getCellMode={getCellMode}
          onCellPress={handleCellPress}
        />
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotFacility]} />
            <Text style={styles.legendLabel}>Facility</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotTraveling]} />
            <Text style={styles.legendLabel}>Traveling</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.dotBoth]} />
            <Text style={styles.legendLabel}>Either</Text>
          </View>
        </View>
      </View>

      {legacySlots.length > 0 && (
        <View style={styles.legacySection}>
          <Text style={styles.legacyTitle}>LEGACY AVAILABILITY</Text>
          <Text style={styles.legacyNote}>
            These slots have custom time ranges from before the grid editor. They remain active — delete if no longer needed.
          </Text>
          {legacySlots.map(slot => {
            const timeLabel = `${DAY_NAMES[slot.day_of_week]}  ${fmtTime(slot.start_time)} – ${fmtTime(slot.end_time)}`;
            const locLabel  = LOCATION_OPTIONS.find(o => o.value === slot.location_mode)?.label
              ?? slot.location_mode ?? '—';
            return (
              <View key={slot.id} style={styles.legacyRow}>
                <View style={styles.legacyInfo}>
                  <Text style={styles.legacyTime}>{timeLabel}</Text>
                  <Text style={styles.legacyLoc}>{locLabel}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteLegacy(slot.id, timeLabel)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color={Colors.negative} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container:   { gap: 12 },
    headerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontFamily:    FontFamily.jetbrainsMonoSemiBold,
      fontSize:      FontSize.eyebrow,
      color:         theme.textMuted,
      letterSpacing: 0.18,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius:    Radius.sm,
      paddingHorizontal: 14,
      paddingVertical:   8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize:   FontSize.label,
      color:      '#FFFFFF',
    },
    hint: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
      fontStyle:  'italic',
    },
    gridCard: {
      backgroundColor: theme.cardBg,
      borderRadius:    Radius.card,
      borderWidth:     1,
      borderColor:     theme.border,
      padding:         Spacing.cardPadding,
      gap:             12,
    },
    legend: {
      flexDirection:  'row',
      gap:            16,
      paddingTop:     8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           5,
    },
    legendDot: {
      width:        10,
      height:       10,
      borderRadius: 5,
      borderWidth:  1,
    },
    dotFacility: {
      backgroundColor: 'rgba(45,107,255,0.30)',
      borderColor:     'rgba(45,107,255,0.55)',
    },
    dotTraveling: {
      backgroundColor: 'rgba(214,255,61,0.25)',
      borderColor:     'rgba(214,255,61,0.45)',
    },
    dotBoth: {
      backgroundColor: 'rgba(45,224,255,0.25)',
      borderColor:     'rgba(45,224,255,0.45)',
    },
    legendLabel: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   12,
      color:      theme.textMuted,
    },
    legacySection: {
      backgroundColor: theme.cardBg,
      borderRadius:    Radius.card,
      borderWidth:     1,
      borderColor:     theme.border,
      padding:         Spacing.cardPadding,
      gap:             10,
    },
    legacyTitle: {
      fontFamily:    FontFamily.jetbrainsMonoSemiBold,
      fontSize:      FontSize.eyebrow,
      color:         Colors.volt,
      letterSpacing: 0.18,
    },
    legacyNote: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
      lineHeight: 20,
    },
    legacyRow: {
      flexDirection:  'row',
      alignItems:     'center',
      backgroundColor: theme.bgElevated,
      borderRadius:    Radius.sm,
      borderWidth:     1,
      borderColor:     theme.border,
      paddingHorizontal: 14,
      paddingVertical:   11,
    },
    legacyInfo: { flex: 1, gap: 2 },
    legacyTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize:   FontSize.label,
      color:      theme.textPrimary,
    },
    legacyLoc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize:   FontSize.label,
      color:      theme.textMuted,
    },
  }), [theme]);
}
