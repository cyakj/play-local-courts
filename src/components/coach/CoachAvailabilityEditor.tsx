import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import type { CoachAvailabilitySlot } from '@/hooks/useCoachAvailability';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

const LOCATION_MODES = [
  { value: 'coach_facility', label: 'My Facility' },
  { value: 'traveling',      label: 'Traveling'   },
  { value: 'both',           label: 'Either'       },
];

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`;
}

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

interface Props {
  slots: CoachAvailabilitySlot[];
  onRefresh: () => void;
}

export function CoachAvailabilityEditor({ slots, onRefresh }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();

  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [showModal, setShowModal]     = useState(false);
  const [editingSlot, setEditingSlot] = useState<CoachAvailabilitySlot | null>(null);
  const [newDay, setNewDay]           = useState(1);
  const [newStart, setNewStart]       = useState('09:00');
  const [newEnd, setNewEnd]           = useState('12:00');
  const [newLocation, setNewLocation] = useState<string>('coach_facility');
  const [saving, setSaving]           = useState(false);

  const daySlots = useMemo(
    () =>
      slots
        .filter(s => s.day_of_week === selectedDay)
        .slice()
        .sort((a, b) => normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))),
    [slots, selectedDay],
  );

  const swipeRef = useRef(selectedDay);
  swipeRef.current = selectedDay;

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, state) =>
      Math.abs(state.dx) > Math.abs(state.dy) && Math.abs(state.dx) > 12,
    onPanResponderRelease: (_, state) => {
      if (state.dx < -40) setSelectedDay(d => Math.min(d + 1, 6));
      else if (state.dx > 40) setSelectedDay(d => Math.max(d - 1, 0));
    },
  }), []);

  function openAdd() {
    setEditingSlot(null);
    setNewDay(selectedDay);
    setNewStart('09:00');
    setNewEnd('12:00');
    setNewLocation('coach_facility');
    setShowModal(true);
  }

  function openEdit(slot: CoachAvailabilitySlot) {
    setEditingSlot(slot);
    setNewDay(slot.day_of_week);
    setNewStart(normalizeTime(slot.start_time));
    setNewEnd(normalizeTime(slot.end_time));
    setNewLocation(slot.location_mode ?? 'coach_facility');
    setShowModal(true);
  }

  function openCopy(slot: CoachAvailabilitySlot) {
    setEditingSlot(null);
    setNewDay(slot.day_of_week);
    setNewStart(normalizeTime(slot.start_time));
    setNewEnd(normalizeTime(slot.end_time));
    setNewLocation(slot.location_mode ?? 'coach_facility');
    setShowModal(true);
  }

  async function handleDelete(slot: CoachAvailabilitySlot) {
    Alert.alert(
      'Remove Slot',
      `Remove ${DAY_NAMES[slot.day_of_week]} ${fmtTime(normalizeTime(slot.start_time))} – ${fmtTime(normalizeTime(slot.end_time))}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('coach_availability')
              .delete()
              .eq('id', slot.id)
              .select('id');
            if (error) { Alert.alert('Error', error.message); return; }
            if (!data || data.length === 0) { Alert.alert('Error', 'Slot not found or could not be removed.'); return; }
            onRefresh();
          },
        },
      ],
    );
  }

  async function handleSave() {
    setSaving(true);

    // Validate start < end (UI chips already enforce this, but double-check)
    if (newStart >= newEnd) {
      setSaving(false);
      Alert.alert('Invalid Times', 'Start time must be before end time.');
      return;
    }

    // Check for exact duplicate among other slots on the same day
    const otherSlots = slots.filter(s =>
      s.day_of_week === newDay && (!editingSlot || s.id !== editingSlot.id)
    );
    const isExactDuplicate = otherSlots.some(s =>
      normalizeTime(s.start_time) === newStart && normalizeTime(s.end_time) === newEnd
    );
    if (isExactDuplicate) {
      setSaving(false);
      Alert.alert('Duplicate Slot', 'This availability already exists.');
      return;
    }

    // Check for overlapping slots: new_start < existing_end AND new_end > existing_start
    const hasOverlap = otherSlots.some(s => {
      const existStart = normalizeTime(s.start_time);
      const existEnd   = normalizeTime(s.end_time);
      return newStart < existEnd && newEnd > existStart;
    });
    if (hasOverlap) {
      setSaving(false);
      Alert.alert('Schedule Conflict', 'This slot overlaps with an existing availability window. Please adjust the times or remove the conflicting slot first.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (editingSlot) {
      const { error: delErr } = await supabase.from('coach_availability').delete().eq('id', editingSlot.id);
      if (delErr) { setSaving(false); Alert.alert('Error', delErr.message); return; }
    }

    const { error } = await supabase
      .from('coach_availability')
      .upsert(
        { coach_id: user.id, day_of_week: newDay, start_time: newStart, end_time: newEnd, location_mode: newLocation },
        { onConflict: 'coach_id,day_of_week,start_time' },
      );

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    onRefresh();
  }

  const isEditing = editingSlot != null;
  const saveLabel  = saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Slot';
  const validStart = TIME_OPTIONS.filter(t => t < newEnd);
  const validEnd   = TIME_OPTIONS.filter(t => t > newStart);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Text style={styles.sectionTitle}>AVAILABILITY</Text>

      {/* Day selector pills — Sun through Sat */}
      <View style={styles.dayRow}>
        {DAY_SHORT.map((label, i) => {
          const hasSlots = slots.some(s => s.day_of_week === i);
          const active = selectedDay === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{label}</Text>
              {hasSlots && !active && <View style={styles.dayDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Slots for selected day — swipeable */}
      <View {...panResponder.panHandlers}>
        {daySlots.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No slots on {DAY_NAMES[selectedDay]}
            </Text>
            <Text style={[styles.emptySubText, { color: theme.textMuted }]}>
              Swipe left/right to change day, or tap below to add.
            </Text>
          </View>
        ) : (
          <View style={styles.slotList}>
            {daySlots.map(slot => (
              <View key={slot.id} style={[styles.slotRow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.slotInfo}>
                  <Text style={[styles.slotTime, { color: theme.textPrimary }]}>
                    {fmtTime(normalizeTime(slot.start_time))} – {fmtTime(normalizeTime(slot.end_time))}
                  </Text>
                  <Text style={[styles.slotLocation, { color: theme.textMuted }]}>
                    {LOCATION_MODES.find(m => m.value === slot.location_mode)?.label ?? slot.location_mode ?? '—'}
                  </Text>
                </View>
                <View style={styles.slotActions}>
                  <TouchableOpacity
                    onPress={() => openCopy(slot)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    activeOpacity={0.7}>
                    <Copy size={15} color={theme.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openEdit(slot)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    activeOpacity={0.7}>
                    <Pencil size={15} color={theme.textMuted} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(slot)}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    activeOpacity={0.7}>
                    <Trash2 size={15} color={Colors.negative} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add slot for this day */}
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus size={14} color={Colors.blue} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add Slot on {DAY_NAMES[selectedDay]}</Text>
        </TouchableOpacity>
      </View>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>
            {isEditing ? 'Edit Availability Slot' : 'Add Availability Slot'}
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>DAY OF WEEK</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {[0, 1, 2, 3, 4, 5, 6].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, { borderColor: theme.border }, newDay === d && styles.chipActive]}
                onPress={() => setNewDay(d)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, { color: theme.textSecondary }, newDay === d && styles.chipTextActive]}>
                  {DAY_SHORT[d]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>START TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {validStart.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, { borderColor: theme.border }, newStart === t && styles.chipActive]}
                onPress={() => setNewStart(t)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, { color: theme.textSecondary }, newStart === t && styles.chipTextActive]}>
                  {fmtTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>END TIME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {validEnd.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, { borderColor: theme.border }, newEnd === t && styles.chipActive]}
                onPress={() => setNewEnd(t)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, { color: theme.textSecondary }, newEnd === t && styles.chipTextActive]}>
                  {fmtTime(t)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>LOCATION</Text>
          <View style={styles.chipRow}>
            {LOCATION_MODES.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, { borderColor: theme.border }, newLocation === m.value && styles.chipActive]}
                onPress={() => setNewLocation(m.value)}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, { color: theme.textSecondary }, newLocation === m.value && styles.chipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    sectionTitle: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    dayRow: {
      flexDirection: 'row',
      gap: 6,
    },
    dayPill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      position: 'relative',
    },
    dayPillActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.15)',
    },
    dayPillText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.4,
    },
    dayPillTextActive: {
      color: Colors.blue,
    },
    dayDot: {
      position: 'absolute',
      bottom: 5,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.cyan,
    },
    slotList: { gap: 8 },
    emptyCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      paddingVertical: 24,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 6,
    },
    emptyText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      textAlign: 'center',
    },
    emptySubText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      textAlign: 'center',
      lineHeight: 20,
    },
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.sm,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    slotInfo: { flex: 1, gap: 2 },
    slotTime: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
    },
    slotLocation: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
    },
    slotActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingLeft: 8,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 13,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(45,107,255,0.30)',
      backgroundColor: 'rgba(45,107,255,0.07)',
    },
    addBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
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
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderTopWidth: 1,
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 12,
      gap: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 4,
    },
    sheetTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      letterSpacing: -0.2,
    },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      letterSpacing: 0.18,
      marginTop: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      minHeight: 44,
      borderRadius: Radius.chip,
      borderWidth: 1,
      justifyContent: 'center',
    },
    chipActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.15)',
    },
    chipText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.label,
    },
    chipTextActive: {
      color: Colors.blue,
    },
    saveBtn: {
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 8,
    },
    btnDisabled: { opacity: 0.5 },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },
  }), [theme]);
}
